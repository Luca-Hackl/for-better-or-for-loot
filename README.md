# RedSec Ranked — Squad HQ 🎯

A private, esport-style dashboard for **two players** to track their **Battlefield 6 RedSec**
rounds — with a focus on **Ranked RP progression**, memorized **drop zones**, and **head-to-head**
kills/assists/deaths. Built for an anniversary. 27 years, still dropping together.

## Features
- **Overview** — RP-over-time hero chart, live rank badge, KPI tiles (win rate, RP/match, avg RP
  win/loss, net RP, streaks), and an auto-pulled lifetime **Career** panel.
- **Matches** — fast post-match entry (mode, placement, RP, rank, per-player K/A/D, MVP, **1..n**
  drop/redeploy/respawn locations, optional screenshot), esport scoreboard cards + full match detail.
- **Drop Zones** — a tactical Fort Lyndon map + best-drop leaderboard (win rate, avg placement, avg
  RP, avg kills per POI) with per-location **ratings & feedback**.
- **Head-to-Head** — you-vs-them radar, career totals, and per-stat crowns.
- **Private** — email+password auth locked to your two accounts, Postgres Row-Level Security.

## Tech stack (all free tiers)
Next.js 16 (App Router, React 19) · Supabase (Postgres + Auth + Storage + RLS) · Tailwind v4 ·
Recharts · TypeScript · deployed on Vercel.

## Quick start
```bash
cp .env.local.example .env.local   # add your Supabase keys
npm install
npm run dev
```
See **[DEPLOY.md](./DEPLOY.md)** for full Supabase + Vercel setup.

## Data sourcing (the honest version)
Battlefield 6 / RedSec has **no official stats API** and stats live server-side (kernel anti-cheat
makes reading local files/memory a ban risk). So per-match RP, K/A/D, and drop locations are
**entered manually** — which is also what makes the location memory and feedback personal. The
Career panel is a best-effort lifetime aggregate from the free `gametools.network` community API
(no RP, no per-match detail, may include bot kills). The entry form is **OCR-ready** so a
screenshot → auto-fill flow can be added later without a schema change.

## Project layout
```
app/(auth)/login      email+password sign-in
app/(app)/            authed shell + Overview, Matches, Drop Zones, Head-to-Head, Settings
app/api/career        gametools aggregate fetch (fail-soft, cached)
lib/                  supabase clients, data access, server actions, rank ladder, stats
components/           UI primitives, charts, cards, badges
supabase/migrations/  schema + RLS + views + seed
proxy.ts              session refresh + route guard (Next 16 proxy convention)
```
