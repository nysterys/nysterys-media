# 04 — Deployment

How the repo deploys to `nysterys.com` and how to push updates.

---

## How GitHub Pages works (important)

GitHub Pages serves files from the **root of your repository**. Whatever is at the root is what appears at `nysterys.com/`. This is why the repo is structured the way it is:

```
repo root/                  → served at nysterys.com/
├── index.html              → nysterys.com/
├── global.css
├── creator.html            → nysterys.com/creator.html
├── media-kit.html
├── rate-card.html
├── privacy.html
├── data.json
├── utils.js
├── icons.js
├── robots.txt
├── sitemap.xml
├── CNAME                   → tells GitHub Pages your custom domain
│
├── hub/                    → nysterys.com/hub/ (Creator Hub built output)
│   ├── index.html
│   └── static/
│
├── hub-src/                → React source code (not served, version control only)
├── schemas/                → SQL files (not served, version control only)
└── docs/                   → documentation (not served, version control only)
```

The public site files live directly at the root. The Creator Hub built output lives in `/hub/`. The source code in `hub-src/` is just stored for version control — GitHub Pages ignores non-HTML/CSS/JS folders that don't have an index.

---

## One-time GitHub Pages setup

1. Create a new GitHub repository (public, no README)
2. Push this repo to it (see [01-setup.md](01-setup.md))
3. GitHub repo → **Settings** → **Pages**
4. Source: **Deploy from a branch**
5. Branch: **main**, Folder: **/ (root)**
6. Click **Save**

---

## DNS

Your DNS records should already point to GitHub Pages. Verify:

| Type | Name | Value |
|------|------|-------|
| A | @ | `185.199.108.153` |
| A | @ | `185.199.109.153` |
| A | @ | `185.199.110.153` |
| A | @ | `185.199.111.153` |
| CNAME | www | `YOUR-USERNAME.github.io` |

In GitHub repo → Settings → Pages → enable **Enforce HTTPS**.

---

## Images

Image files (`kym.jpg`, `mys.jpg`, etc.) must live at the **repo root** alongside `index.html`. They are not included in this repo — copy them from your existing live site:

```bash
# From wherever your current images are
cp kym.jpg mys.jpg /path/to/this/repo/
git add kym.jpg mys.jpg
git commit -m "Add creator photos"
git push
```

---

## Building and deploying the Creator Hub

**First time — create your env file:**
```bash
cd hub-src
cp .env.example .env.production
# Edit .env.production — fill in your Supabase URL and anon key
npm install
```

**Every deploy:**
```bash
# From repo root
cd hub-src && npm run build && cd ..
mkdir -p hub
cp -r hub-src/build/* hub/
git add hub/
git commit -m "Deploy Creator Hub"
git push
```

GitHub Pages serves `hub/` as `nysterys.com/hub/` automatically.

---

## Deploying public site changes

Edit files at the repo root and push — no build step needed:

```bash
git add index.html  # or whatever changed
git commit -m "Site: describe change"
git push
```

---

## Verifying a deployment

1. `https://nysterys.com` — public site loads with images
2. `https://nysterys.com/hub/` — login page loads
3. Sign in works, admin sees all data, creators see only their own

**Blank hub page:** Open DevTools → Console. Missing env vars means `.env.production` was absent during build.

**No images on public site:** Copy image files to the repo root (see Images section above).

---

## GitHub Actions (optional — automate hub builds)

Create `.github/workflows/deploy-hub.yml`:

```yaml
name: Deploy Creator Hub
on:
  push:
    branches: [main]
    paths: ['hub-src/src/**', 'hub-src/public/**', 'hub-src/package.json']
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Build
        working-directory: hub-src
        env:
          REACT_APP_SUPABASE_URL: ${{ secrets.REACT_APP_SUPABASE_URL }}
          REACT_APP_SUPABASE_ANON_KEY: ${{ secrets.REACT_APP_SUPABASE_ANON_KEY }}
        run: npm ci && npm run build
      - name: Copy to hub/ and push
        run: |
          mkdir -p hub && cp -r hub-src/build/* hub/
          git config user.name "github-actions"
          git config user.email "actions@github.com"
          git add hub/
          git diff --staged --quiet || git commit -m "Auto-deploy hub [skip ci]"
          git push
```

Add secrets in: GitHub repo → Settings → Secrets → Actions → `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY`.
