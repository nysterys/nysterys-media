# 01 — Setup From Scratch

Complete setup guide for the Nysterys Media monorepo. Follow every step in order. Nothing is optional.

---

## What you are setting up

| What | Where |
|------|-------|
| Public website | `nysterys.com/` |
| Creator Hub portal | `nysterys.com/hub/` |
| Database | Supabase (free tier) |
| TikTok analytics sync | Coupler.io (existing subscription) |
| Hosting | GitHub Pages (free) |

---

## Prerequisites

Install these before starting:

- **Node.js** v18 or later — https://nodejs.org
- **Git** — https://git-scm.com
- **A GitHub account** — https://github.com
- **A Supabase account** — https://supabase.com (free)
- Your existing **Coupler.io account**

---

## Step 1 — Create the GitHub repository

1. Go to https://github.com/new
2. Name it `nysterys-media` (or any name you prefer)
3. Set it to **Public** — required for free GitHub Pages
4. Do **not** initialize with a README (you already have one)
5. Click **Create repository**

---

## Step 2 — Push this repo to GitHub

Open Terminal, navigate to this folder, and run:

```bash
git init
git add .
git commit -m "Initial commit — Nysterys Media monorepo"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nysterys-media.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 3 — Configure GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under **Source**, select **Deploy from a branch**
4. Branch: **main**, Folder: **/ (root)**
5. Click **Save**

GitHub Pages will serve your site from the root of the repo. The public site files are in `/site/` and the built hub goes in `/site/hub/` — see the deployment doc for how this works.

> **Note:** GitHub Pages serves from the repo root by default. Your `CNAME` file in `/site/` needs to be at the repo root for custom domains. See Step 3 in [04-deployment.md](04-deployment.md).

---

## Step 4 — Create your Supabase project

1. Go to https://supabase.com and sign in
2. Click **New project**
3. Name it `nysterys-media`
4. Choose region: **US East (N. Virginia)** — closest to Houston
5. Set a strong database password and save it somewhere safe
6. Click **Create new project** and wait ~2 minutes for provisioning

---

## Step 5 — Run the database schemas

Schemas must be run **in order**. Each builds on the previous.

1. In Supabase Dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open `schemas/01-schema.sql` from this repo, paste the entire contents, click **Run**
4. You should see: `Success. No rows returned.`
5. Repeat for `02-schema-tiktok.sql`, `03-schema-payouts.sql`, `04-schema-security.sql`

If any schema fails, check that you ran them in order — later schemas reference tables created by earlier ones.

---

## Step 6 — Configure Supabase Auth settings

In Supabase Dashboard → **Authentication** → **Settings**, change these:

| Setting | Value | Why |
|---------|-------|-----|
| Enable sign ups | **OFF** | Invite-only — you control all accounts |
| Confirm email | **ON** | Every account must verify their email |
| Minimum password length | **12** | Strong passwords required |
| Leaked password protection | **ON** | Checks against HaveIBeenPwned |
| Secure email change | **ON** | Requires confirmation on both old and new email |
| Site URL | `https://nysterys.com/hub/` | Where the app lives |
| Redirect URLs | add `https://nysterys.com/hub/` | Required for password reset links |

In Supabase Dashboard → **Settings** → **API** → **Allowed Origins**, add:
```
https://nysterys.com
```

---

## Step 7 — Set up your environment variables

In the `hub/` folder:

```bash
cd hub
cp .env.example .env.production
```

Open `.env.production` and fill in your values from Supabase Dashboard → **Settings** → **API**:

```
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Use the **anon / public** key (not the service_role key).

> `.env.production` is in `.gitignore` and will never be committed. You must recreate it on any new machine.

---

## Step 8 — Create user accounts

Since sign-ups are disabled, all accounts are created by invitation:

**For yourself (admin):**
1. Supabase Dashboard → **Authentication** → **Users** → **Invite User**
2. Enter your email address
3. Check your email, accept the invite, set your password
4. Go to **Table Editor** → **profiles**
5. Find your row, set `role = admin`, `full_name = your name`

**For Kym:**
1. Same process — Invite User with her email
2. After she accepts and logs in once, go to **profiles** table
3. Set: `role = creator`, `full_name = Kym`, `creator_name = Kym`

**For Mys:**
1. Same process
2. Set: `role = creator`, `full_name = Mys`, `creator_name = Mys`

---

## Step 9 — Build and deploy the hub

```bash
# From the repo root
cd hub-src
cp .env.example .env.production
# Fill in your Supabase URL and anon key in .env.production
npm install
npm run build
cd ..
```

Copy the build output to `hub/` at the repo root (this is what GitHub Pages serves at `nysterys.com/hub/`):

```bash
mkdir -p hub
cp -r hub-src/build/* hub/
```

Commit and push:

```bash
git add hub/
git commit -m "Deploy Creator Hub"
git push
```

GitHub Pages deploys automatically within 1–3 minutes.

---

## Step 10 — First login and app configuration

1. Go to `https://nysterys.com/hub/` and sign in as admin
2. **Setup → Agencies & Labels** — add YTK Media, Vasily's label, and any others
3. **Setup → Platforms** — TikTok, Instagram, YouTube are pre-seeded; add others if needed
4. **Setup → Deliverable Types** — pre-seeded; add custom types as needed
5. **Setup → Payment Destinations** — add Kym and Mys's payout accounts (Savings, UTMA, etc.)
6. **Setup → TikTok Accounts** — link Kym and Mys's TikTok usernames
7. Configure Coupler.io — see [03-coupler.md](03-coupler.md)

---

## Step 11 — Verify everything works

- [ ] `nysterys.com` loads the public site
- [ ] The nav shows a "Team Portal" link
- [ ] `nysterys.com/hub/` loads the login page
- [ ] You can sign in as admin
- [ ] Kym can sign in and sees only her campaigns
- [ ] Mys can sign in and sees only her campaigns
- [ ] Creating a campaign works end to end
- [ ] Payment destinations appear in payout splits

You are set up. Refer to the other docs for Coupler.io analytics, ongoing deployment, and security.
