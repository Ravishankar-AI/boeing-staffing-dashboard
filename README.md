# Boeing Staffing Dashboard

One shared view of the Boeing staffing program. It replaces the
"TOR 6131 – Objectways Hiring" workbook. Boeing, Objectways recruiters, and
leadership see the same numbers: open vs. filled positions, resumes sent,
where each candidate is in the interview process, and who each candidate is
waiting on.

| Persona | Role | Can |
| --- | --- | --- |
| Boeing hiring team | `client` | View the dashboard and candidates (read-only) |
| Objectways recruiters | `recruiter` | Add resumes sent to Boeing and change candidate status |
| Leadership (Ravi) | `admin` | Everything, plus edit openings and headcount (`/positions`) |

## Screens

- `/`: KPIs (open positions, filled, resumes sent, in interview, waiting on
  Boeing, selected/onboarded), the hiring funnel, a "waiting on Boeing" queue
  with days waiting, a positions table, and recent activity. Filter by
  engagement and US/India.
- `/submissions`: every resume sent, filterable by engagement, location,
  status, and name. Recruiters change status inline.
- `/submissions/new`: add a resume sent to Boeing.
- `/positions`: add a new opening from Boeing and update required/filled counts (admin only).

## Data model

`Engagement` (one per workbook tab / Boeing POC) → `Position` (title,
location, required, filled) → `Submission` (one resume sent to Boeing for
one position). The workbook spread a candidate's state across four free-text
columns. Here it is a single `stage` (see `src/lib/stages.ts`), so every view
counts the same way.

`prisma/seed.ts` is transcribed from the workbook. It includes notes on how
the ambiguous cells were resolved (missing "sent" dates, and the CR04 US Data
Engineer count that disagrees with the summary tab).

## Database: the same Railway Postgres as Objectways Data

This app uses the catalog app's Railway Postgres database, but in its own
Postgres schema, `staffing`. You choose the schema by adding
`?schema=staffing` to `DATABASE_URL`. Both apps have a `User` table and their
own Prisma migration history, and the separate schema keeps them apart.
Neither app's `prisma migrate` can see or drop the other's tables.

## Deploy on Railway

1. In the existing Railway project (the one with the Postgres service), click
   **New → GitHub Repo** and pick this repo.
2. On the new service, go to **Variables** and add:
   `DATABASE_URL` = `${{Postgres.DATABASE_URL}}?schema=staffing`
   (use the name of your Postgres service in place of `Postgres` if it's different).
3. Deploy. `railway.json` builds with `npm run build`. Before each release it
   runs `prisma migrate deploy`, which creates the `staffing` schema and its
   tables on the first deploy. It then runs `npm run db:seed:if-empty`, which
   loads the workbook data only while the tables are empty, so later deploys
   never overwrite recruiters' updates. Finally it starts `next start` on
   Railway's `$PORT`.
4. To reset the data back to the workbook, run the full seed from your machine:
   `DATABASE_URL="<public Postgres URL>?schema=staffing" npm run db:seed`.
   This wipes the staffing tables first. Or truncate the tables and paste
   `prisma/manual-seed.sql` into **Postgres → Data → Query**.
5. **Settings → Networking → Generate Domain** to get a URL to share.

## Local development

```bash
npm install
cp .env.example .env   # DATABASE_URL with ?schema=staffing
npm run db:deploy      # or db:migrate while changing the schema
npm run db:seed
npm run dev
```

Visit `/sign-in` and pick a persona.

## Before real Boeing users log in

Sign-in is a **mock persona picker** (`src/lib/auth.ts`). It trusts a cookie
and has no passwords, so it is fine for a demo URL but not for production
data. Replace it with real SSO (Auth.js, or Clerk / Microsoft Entra, which
Boeing will likely want) and keep the `Session` shape. The pages only read
`role`.
