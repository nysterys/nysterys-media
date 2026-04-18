# Nysterys Media — Install Package

Complete source for a fresh rebuild of nysterys.com and the Creator Hub at nysterys.com/hub/.

## Start here

1. Read `docs/FRESH-INSTALL.md` for step-by-step setup
2. Read `docs/MASTER-REFERENCE.md` for full system documentation and Claude context

## Package contents

| Directory | Contents |
|---|---|
| `hub-src/` | React source for the Creator Hub |
| `schemas/` | Supabase SQL schema (single consolidated file) |
| `public-site/` | Static public site files (copy to repo root) |
| `docs/` | Master reference and install guide |

## For a new Claude session

Paste into the first message:

> This is the Nysterys Media Creator Hub — a React/Supabase influencer management portal for Patrick Nijsters managing creators Kym and Mys. The repo is at ~/Downloads/nysterys-media/. Hub source in hub-src/, built output in hub/, schema in schemas/SCHEMA.sql. Supabase URL: https://rnntuxabccnphfvvvaks.supabase.co. Read docs/MASTER-REFERENCE.md before starting work. [Describe the specific change you want.]
