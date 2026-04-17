# 05 — Security Reference

Security model, threat surface, controls in place, and ongoing maintenance.

---

## Threat model

This is a private internal tool used by three people (you, Kym, Mys). The realistic threats are:

1. **Unauthorized access** — someone who isn't you, Kym, or Mys accessing the hub
2. **Privilege escalation** — a creator account accessing admin data or another creator's data
3. **Data exposure via the database** — someone using the Supabase anon key to query data directly
4. **Credential theft** — a user's password being compromised
5. **Session hijacking** — a valid session token being stolen
6. **Dependency vulnerabilities** — a compromised npm package

This is not a high-value target for sophisticated attacks. The controls in place are appropriate for the risk level.

---

## Security controls in place

### Database layer (Supabase RLS)

Every table has Row Level Security enabled. The enforcement model:

| Role | Can read | Can write |
|------|----------|-----------|
| `admin` | Everything | Everything |
| `creator` | Own campaigns, deliverables, payouts, TikTok data | Own deliverables (post URL, draft submission), own comments |
| Anonymous (not logged in) | Nothing | Nothing |

**Role escalation prevention:** The `profiles` update policy includes a `with check` clause that prevents any user from changing their own `role` field. Role changes must be made directly in the Supabase dashboard.

**TikTok data isolation:** Each TikTok analytics table joins to `tiktok_accounts` to ensure creators only see data for their own TikTok username. A fixed bug (in `04-schema-security.sql`) corrected an ambiguous column reference that could have allowed cross-creator reads.

**Payout summary view:** Uses `security_invoker = true`, meaning the view inherits the permissions of the calling user rather than the view owner. A creator querying this view cannot see another creator's payout data.

**Audit log:** The `audit_log` table has no update or delete policies — it is physically immutable once written. Only admins can read it.

### Application layer

**Authentication:** Handled entirely by Supabase Auth (JWT-based, industry standard). Sessions use PKCE flow — more secure than implicit flow for single-page apps.

**Login rate limiting:** The login form enforces a client-side lockout after 5 failed attempts (15-minute lockout). Supabase Auth also applies server-side rate limiting independently.

**Password reset:** Available from the login page. The reset flow uses generic success messaging ("if that email is registered...") to prevent email enumeration — an attacker cannot determine whether an email address has an account.

**No self-registration:** Sign-ups are disabled in Supabase Auth. All accounts are created by invitation. An attacker cannot create their own account.

**Email verification:** Every invited user must confirm their email before they can log in.

**Profile validation on login:** If a user's profile row cannot be fetched after authentication (missing or inaccessible), the app immediately signs them out. This prevents a partially-created account from having any access.

### Transport and browser layer

**HTTPS:** Enforced via GitHub Pages (enable in Settings → Pages → Enforce HTTPS) and your DNS.

**Content Security Policy:** Set via meta tag in the hub's `index.html`. Restricts:
- Scripts to same-origin only
- Network requests (`connect-src`) to Supabase endpoints only
- Frames disallowed (`frame-ancestors 'none'`)

**X-Frame-Options: DENY** — prevents the hub from being embedded in an iframe (clickjacking protection).

**noindex, nofollow** — the hub is excluded from search engine indexing. It is not publicly discoverable by search.

**Referrer-Policy: strict-origin-when-cross-origin** — limits what URL information is sent in outgoing requests.

---

## The anon key: why it is safe in the browser

The Supabase anon (public) key is visible in the compiled JavaScript bundle. This is expected and unavoidable with static hosting. It is not a security issue because:

1. The anon key only grants access to what anonymous users are allowed to see — with your RLS policies, that is nothing. Every table requires `auth.uid() is not null` at minimum.
2. Supabase is designed for this model. The anon key is documented as safe for client-side use when RLS is correctly configured.
3. What would actually be dangerous — and must never go in the browser — is the **service_role** key, which bypasses RLS entirely. That key is only used in Coupler.io (server-side) and never in the app.

---

## What is NOT protected

Be aware of these limitations:

- **No server-side rendering or secret management.** This is a static site. There is no server to keep secrets on.
- **The anon key is visible in the browser** — mitigated by RLS as described above.
- **Client-side rate limiting can be bypassed** — a determined attacker can clear the lockout counter by opening a new browser tab. Supabase's server-side rate limiting provides the real protection.
- **No MFA currently configured** — Supabase supports TOTP-based MFA. Worth enabling for the admin account via Dashboard → Authentication → Multi-Factor Authentication.
- **No IP allowlist** — Supabase does not support IP allowlisting on the free tier. Not a realistic concern for this use case.

---

## Recommended: Enable MFA for the admin account

1. Supabase Dashboard → Authentication → Multi-Factor Authentication → Enable
2. Sign in to the hub as admin
3. The hub does not currently have a MFA enrollment flow — enroll via Supabase Dashboard directly
4. Worth adding an MFA enrollment screen to the hub in a future update

---

## Ongoing security maintenance

**Monthly:**
- Review `audit_log` for any unexpected access patterns
- Check Supabase Dashboard → Authentication → Users for any unexpected accounts

**When a user leaves:**
- Supabase Dashboard → Authentication → Users → delete their account immediately
- Their data (campaigns, comments) remains but is unlinked from any active session

**When rotating credentials:**
1. Generate new anon key in Supabase Dashboard → Settings → API → Roll API key
2. Update `hub/.env.production` with the new key
3. Rebuild and redeploy the hub (see [04-deployment.md](04-deployment.md))
4. Old key stops working immediately after rotation

**npm dependency updates:**
```bash
cd hub
npm audit
npm audit fix
# Test that the hub still builds correctly
npm run build
```
Run this monthly or whenever a security advisory is published for a dependency.

---

## Security controls summary table

| Control | Layer | Status |
|---------|-------|--------|
| Row Level Security on all tables | Database | ✓ Active |
| Role escalation prevention | Database | ✓ Active |
| TikTok RLS column fix | Database | ✓ Active (schema 04) |
| Payout view security invoker | Database | ✓ Active (schema 04) |
| Audit log (append-only) | Database | ✓ Active (schema 04) |
| Sign-ups disabled | Auth | ✓ Must enable in dashboard |
| Email confirmation required | Auth | ✓ Must enable in dashboard |
| Min password length 12 | Auth | ✓ Must enable in dashboard |
| Leaked password check | Auth | ✓ Must enable in dashboard |
| PKCE auth flow | App | ✓ Active |
| Client-side login rate limit | App | ✓ Active (5 attempts) |
| Email enumeration prevention | App | ✓ Active (password reset) |
| Profile validation on login | App | ✓ Active |
| Content Security Policy | Browser | ✓ Active |
| X-Frame-Options: DENY | Browser | ✓ Active |
| noindex / nofollow | Browser | ✓ Active |
| HTTPS enforcement | Transport | ✓ Via GitHub Pages |
| No service_role key in browser | App | ✓ Never included |
| MFA for admin | Auth | ⚠ Recommended, not yet configured |
