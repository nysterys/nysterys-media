# 01 — Setup From Scratch

Complete setup guide. Follow every step in order.

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

## How the repo works with GitHub Pages

GitHub Pages serves files from the **root of your repository**. This repo is structured so that the public site files (`index.html`, `global.css`, etc.) live at the root — exactly where GitHub Pages expects them.

The Creator Hub is a React app. You build it locally and the output (a folder of static files) goes into `hub/` at the repo root. GitHub Pages then serves that automatically at `nysterys.com/hub/`.

The source code (`hub-src/`), schemas (`schemas/`), and docs (`docs/`) are stored in the repo for version control but GitHub Pages ignores them — they have no `index.html` at their level.

---

## Step 1 — Create the GitHub repository

1. Go to https://github.com/new
2. Name it `nysterys-media` (or any name you prefer)
3. Set visibility to **Public** — required for free GitHub Pages
4. Do **not** initialize with a README
5. Click **Create repository**

---

## Step 2 — Add your image files

The public site HTML references `kym.jpg` and `mys.jpg` with relative paths. These images must be added to the repo root before the site will display them.

Copy your creator photos into the root of this folder (alongside `index.html`):

```bash
# Example — adjust paths to wherever your images are
cp ~/Downloads/kym.jpg .
cp ~/Downloads/mys.jpg .
```

Any other images referenced in the HTML go here too.

---

## Step 3 — Build the Creator Hub

The `hub/` folder that GitHub Pages will serve does not exist yet — you create it by building the React source. Do this before the first push so the hub is included in your initial commit.

```bash
# Navigate into the hub source folder
cd hub-src

# Create your environment file
cp .env.example .env.production
```

Open `.env.production` and fill in your Supabase credentials (you will get these in Step 5, but you can come back to this):

```
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

Use the **anon / public** key. Never use the service_role key here.

> `.env.production` is in `.gitignore` and will never be committed to git. Keep it only on your local machine.

Install dependencies and build:

```bash
npm install
npm run build
cd ..
```

Copy the build output to `hub/` at the repo root:

```bash
mkdir hub
cp -r hub-src/build/* hub/
```

You now have a `hub/` folder at the repo root. That is what GitHub Pages will serve at `nysterys.com/hub/`.

---

## Step 4 — Push to GitHub

From the repo root:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nysterys-media.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 5 — Create your Supabase project

1. Go to https://supabase.com and sign in
2. Click **New project**
3. Name it `nysterys-media`
4. Choose region: **US East (N. Virginia)** — closest to Houston
5. Set a strong database password and save it somewhere safe
6. Click **Create new project** and wait ~2 minutes

Once created, go to **Settings → API** and note down:
- **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
- **anon / public key** — the long `eyJ...` string

Go back to `hub-src/.env.production` and fill these in, then rebuild and redeploy the hub (repeat the build and copy steps from Step 3, then `git add hub/ && git commit -m "Add Supabase config" && git push`).

---

## Step 6 — Run the database schemas

Schemas must be run **in order**. Each one builds on the previous.

1. In Supabase Dashboard → **SQL Editor** → **New query**
2. Open `schemas/01-schema.sql`, paste the entire contents, click **Run**
3. You should see: `Success. No rows returned.`
4. Repeat for `02-schema-tiktok.sql`, `03-schema-payouts.sql`, `04-schema-security.sql`

If any schema fails, confirm you ran them in order — later schemas reference tables from earlier ones.

---

## Step 7 — Configure Supabase Auth

In Supabase Dashboard → **Authentication** → **URL Configuration**:

| Setting | Value |
|---------|-------|
| Site URL | `https://nysterys.com/hub/` |
| Redirect URLs | add `https://nysterys.com/hub/` |

In Supabase Dashboard → **Authentication** → **Settings**:

| Setting | Value | Why |
|---------|-------|-----|
| Enable sign ups | **OFF** | Invite-only — you control all accounts |
| Confirm email | **ON** | Every account must verify their email |
| Minimum password length | **12** | Strong passwords required |
| Leaked password protection | **ON** | Checks against HaveIBeenPwned |
| Secure email change | **ON** | Requires confirmation on both addresses |

---

## Step 8 — Configure GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under **Source**, select **Deploy from a branch**
4. Branch: **main**, Folder: **/ (root)**
5. Click **Save**
6. Enable **Enforce HTTPS**

GitHub Pages will now serve `index.html` from the repo root as `nysterys.com/` and `hub/index.html` as `nysterys.com/hub/`.

Allow 1–3 minutes for the initial deployment to go live.

---

## Step 9 — Create user accounts

Sign-ups are disabled, so all accounts are created by invitation from the Supabase dashboard.

**Your admin account:**
1. Supabase Dashboard → **Authentication** → **Users** → **Invite User**
2. Enter your email address
3. Check your email, follow the invite link, set a password (12+ characters)
4. Go to **Table Editor** → **profiles**
5. Find your row, set: `role = admin`, `full_name = Patrick`

**Kym's account:**
1. Invite User → her email
2. After she accepts and logs in once, go to **profiles**
3. Set: `role = creator`, `full_name = Kym`, `creator_name = Kym`

**Mys's account:**
1. Invite User → her email
2. After she accepts and logs in once, go to **profiles**
3. Set: `role = creator`, `full_name = Mys`, `creator_name = Mys`

---

## Step 10 — First login and app configuration

1. Go to `https://nysterys.com/hub/` and sign in as admin
2. **Setup → Agencies & Labels** — add YTK Media, Vasily's label, and any others
3. **Setup → Platforms** — TikTok, Instagram, YouTube are pre-seeded; add others as needed
4. **Setup → Deliverable Types** — pre-seeded; add custom types as needed
5. **Setup → Payment Destinations** — add Kym and Mys's payout accounts (Savings, UTMA, etc.)
6. **Setup → TikTok Accounts** — link Kym and Mys's TikTok usernames
7. Configure Coupler.io — see [03-coupler.md](03-coupler.md)

---

## Step 11 — Verify everything works

- [ ] `nysterys.com` loads the public site with images
- [ ] The nav shows a "Team Portal" link pointing to `/hub/`
- [ ] `nysterys.com/hub/` shows the login page
- [ ] You can sign in as admin and see all views
- [ ] Kym can sign in and sees only her campaigns
- [ ] Mys can sign in and sees only her campaigns
- [ ] Creating a campaign works end to end
- [ ] Payment destinations appear in the payout splits form

---

## Troubleshooting

**Public site shows README instead of the website**
The site files are not at the repo root, or GitHub Pages is configured to serve from a subfolder. Confirm Settings → Pages → Folder is set to `/ (root)` and that `index.html` exists at the repo root (not inside a subfolder).

**No images on the public site**
Image files (`kym.jpg`, `mys.jpg`, etc.) must be at the repo root alongside `index.html`. Copy them there and push.

**`nysterys.com/hub/` shows a blank page**
Open browser DevTools → Console. If you see `Missing Supabase environment variables`, the hub was built without `.env.production` being present. Fill in `hub-src/.env.production`, rebuild, copy to `hub/`, and push again.

**`nysterys.com/hub/` shows a 404**
The `hub/` folder doesn't exist in the repo. Run the build steps in Step 3 and push.
