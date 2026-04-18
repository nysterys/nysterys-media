# Nysterys Media

This repository is the complete source for `nysterys.com` and the internal Creator Hub portal at `nysterys.com/hub/`.

GitHub Pages serves directly from the repo root, so the public site files (`index.html`, `global.css`, etc.) live at the root. The Creator Hub built output lives in `/hub/`. Source code and documentation are in subdirectories that GitHub Pages ignores.

## Repository structure

```
/                     → nysterys.com/ (public site, served by GitHub Pages)
├── index.html
├── global.css
├── creator.html
├── media-kit.html
├── rate-card.html
├── privacy.html
├── data.json
├── utils.js
├── icons.js
├── kym.jpg           ← add your image files here
├── mys.jpg
├── robots.txt
├── sitemap.xml
├── CNAME

/hub/                 → nysterys.com/hub/ (Creator Hub, built output)
├── index.html
└── static/

/hub-src/             → Creator Hub React source (not served)
├── src/
├── public/
├── package.json
└── .env.example

/schemas/             → Supabase SQL files
├── SCHEMA.sql        ← USE THIS for fresh DB setup (consolidated, single file)
└── 01-15-*.sql       ← Historical migration steps (reference only, do not re-run)

/docs/                → Setup and reference documentation
├── 01-setup.md       ← START HERE
├── 02-supabase.md
├── 03-coupler.md
├── 04-deployment.md
└── 05-security.md
```

## Quick start

For a fresh Claude session or full rebuild, start with [docs/00-master-reference.md](docs/00-master-reference.md).
For initial setup, see [docs/01-setup.md](docs/01-setup.md).
