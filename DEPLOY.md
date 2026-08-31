# Deploying RedSec Ranked — Squad HQ

A step-by-step guide to go live on **Supabase** (database + auth) and **Vercel** (hosting).
Both have free tiers that comfortably cover two players. You keep control of all accounts and keys.

---

## 0. Prerequisites
- A [Supabase](https://supabase.com) account (free)
- A [Vercel](https://vercel.com) account (free)
- This project pushed to a GitHub repo (or use the Vercel CLI — see step 5b)

---

## 1. Create the Supabase project
1. Supabase dashboard → **New project**. Pick a name, a strong database password, and a region near you.
2. Wait ~2 minutes for it to provision.

## 2. Create the database schema
1. In the project, open **SQL Editor** → **New query**.
2. Paste the contents of `supabase/migrations/0001_init.sql`, click **Run**.
3. New query again → paste `supabase/migrations/0002_seed.sql`, click **Run**.
   - This creates all tables, row-level security, the stats views, the `screenshots`
     storage bucket, and seeds the Fort Lyndon drop zones + two placeholder players.

> Alternatively, with the Supabase CLI: `npx supabase link --project-ref <ref>` then
> `npx supabase db push`.

## 3. Create your two accounts (and lock the door)
1. **Authentication → Providers → Email**: ensure Email is enabled. Turn **"Allow new users to sign up" OFF**
   (Authentication → **Sign In / Providers** → *Allow new signups*). This makes it invite-only.
2. **Authentication → Users → Add user → Create new user** — do this **twice**, once for each of you.
   Set an email + password and tick **Auto Confirm User**.
3. *(Optional, extra lock)* In SQL Editor, restrict to exactly your two emails:
   ```sql
   insert into public.allowed_emails (email) values
     ('you@example.com'), ('them@example.com');
   ```
   (If you skip this, any signed-in user is allowed — fine, since signups are off.)

## 4. Grab your API keys
Project **Settings → API**. You'll need:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` *(server-only; keep secret)*

## 5. Deploy to Vercel

### 5a. Via the dashboard (recommended)
1. Vercel → **Add New… → Project** → import your GitHub repo.
2. Framework preset auto-detects **Next.js**. Leave build settings default.
3. **Environment Variables** → add the three keys from step 4 (for all environments).
4. **Deploy**. Done — you'll get a `*.vercel.app` URL.

### 5b. Via the CLI
```bash
npm i -g vercel
vercel               # link/create the project
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel --prod        # ship it
```

## 6. Point Supabase auth at your live URL
Supabase → **Authentication → URL Configuration**:
- **Site URL**: your `https://<project>.vercel.app`
- **Redirect URLs**: add the same URL.

## 7. First run
1. Visit your Vercel URL → you'll be redirected to **/login**.
2. Sign in with one of the accounts you created in step 3.
3. Go to **Settings** → rename the two players, set your **EA IDs** + platform, pick accent colors,
   and hit **"This is me"** on your own player.
4. **Log a match** and watch the dashboard come alive.

---

## Running locally
```bash
cp .env.local.example .env.local   # fill in the three keys from step 4
npm install
npm run dev                        # http://localhost:3000
```
Local auth uses the same Supabase project, so add `http://localhost:3000` to the Supabase
**Redirect URLs** too.

## Screenshots (OCR-later)
The match form can attach an end-of-round screenshot; it's stored in the public `screenshots`
bucket and shown on the match detail page. Automatic OCR pre-fill is a planned follow-up — the
schema (`matches.screenshot_url`, `ocr_source`, `ocr_confidence`) is already in place for it.

## Notes on data
There is **no official Battlefield 6 / RedSec stats API** and no readable local game files, so
per-match RP, K/A/D, and drop locations are entered by hand. The Overview's **Career panel** is a
best-effort lifetime-aggregate pull from the free community `gametools.network` API — it has no RP
or per-match detail and may include bot kills. Your logged matches are the source of truth.
