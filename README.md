# Objectways Talent

Client hiring dashboard at https://talent.objectways.com. Boeing is the first client.

One shared view of the Boeing staffing program. It replaces the
"TOR 6131 – Objectways Hiring" workbook. Boeing, Objectways recruiters, and
leadership see the same numbers: open vs. filled positions, resumes sent,
where each candidate is in the interview process, and who each candidate is
waiting on.

| Persona | Role | Can |
| --- | --- | --- |
| Boeing hiring team | `client` | View the dashboard and candidates (read-only) |
| Objectways recruiters | `recruiter` | Add, edit and delete candidates; update openings (status, headcount) at `/positions` |
| Leadership (Ravi) | `admin` | Everything recruiters can do, plus approve users (`/users`) and see the activity log (`/activity`) |

## Screens

- `/`: KPIs (open positions, filled, resumes sent, in interview, waiting on
  Boeing, selected/onboarded), the hiring funnel, a "waiting on Boeing" queue
  with days waiting, a positions table, and recent activity. Filter by
  change request, business owner and US/India. Refreshes itself every minute.
- `/submissions/[id]`: edit any field of a candidate, or delete one added by
  mistake (recruiters and admins; both are recorded in the activity log).
- `/positions` (Openings): change requests and their business owners; add,
  rename or (when empty) delete a CR. Each opening has a business owner,
  status (Open, On hold, Closed) and headcount. Filled is the larger of the
  number entered and the number of the opening's candidates marked
  Onboarded, so onboarding someone updates it automatically; "Filled" shows
  once that reaches required. Only open openings count toward Open positions.
- `/submissions`: every resume sent, filterable by engagement, location,
  status, and name. Recruiters change status inline.
- `/submissions/new`: add a candidate sent to Boeing, with their resume file
  (PDF or Word, up to 10 MB). Resumes can be replaced or removed on the edit
  page, and anyone signed in (including Boeing) downloads them from
  `/submissions`. Files are stored in Postgres (`ResumeFile`), are checked by
  their contents rather than their names, and every upload, removal and
  download is recorded in the activity log.

## Data model

`ChangeRequest` (e.g. CR04) ⇄ `BusinessOwner` (many-to-many through
`ChangeRequestOwner`: a CR can have several owners and an owner several CRs)
→ `Position` (one CR and one owner; title, location, required, filled,
status) → `Submission` (one resume sent to Boeing for one position) →
`ResumeFile`. Migration `20261009000000_change_requests` turned the earlier
one-POC "engagements" into this, merging workbook tabs that shared a CR. The workbook spread a candidate's state across four free-text
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

Sign in as `ravi@objectways.com` with `ADMIN_PASSWORD`, or register at `/register` and approve yourself from the admin account.

## Accounts and activity

- **Register:** people request an account at `/register` with their name,
  work email, company and a password (scrypt-hashed, `src/lib/passwords.ts`).
  New accounts are `pending` and can't see anything.
- **Approve:** admins approve or reject requests at `/users` and choose the
  role (client read-only, recruiter, admin). The role is pre-filled from what
  the person picked when registering. Admins can also change roles or disable
  accounts there. A disabled user is signed out on their next request.
- **Activity:** `/activity` (admins only) shows sign-ins, failed sign-ins,
  registrations, approvals, candidate status changes, new resumes and edits to
  openings, with who did each one and when (`src/lib/activity.ts`).

Railway variables:

| Variable | Purpose |
| --- | --- |
| `SESSION_SECRET` | Signs the login cookie (32+ random characters). Changing it signs everyone out. |
| `ADMIN_PASSWORD` | First-time password for the seeded admin (`ravi@objectways.com`) on a fresh database. After the first sign-in it's stored as their own password. |

## Mailbox import (consulting@objectways.com)

Recruiters copy **consulting@objectways.com** when they email profiles to
Boeing. Every 10 minutes a Railway cron service calls
`POST /api/inbox/sync` (with `Authorization: Bearer $CRON_SECRET`). The app
then:

1. Reads new inbox mail from that one mailbox through Microsoft Graph
   (read-only; `src/lib/graph.ts`).
2. Keeps resume attachments that pass the same PDF/Word checks as uploads.
3. Asks Claude (`claude-opus-5-5`, structured JSON output; `src/lib/extract.ts`)
   which candidates the email submits and for which opening. PDF resumes are
   sent as documents. The email is treated as data, and position ids and file
   names are checked against what was sent.
4. Stores one **draft** per candidate. Recruiters review drafts at `/inbox`,
   fix anything, and **Confirm** (creates the candidate and attaches the
   resume) or **Dismiss**. Nothing from email is visible to Boeing until a
   person confirms it.

Each email is processed once (keyed by its Graph id). Failed emails show on
`/inbox` with a Retry button, and "Check now" runs a sync immediately.

### Microsoft 365 setup (one time, by a Microsoft 365 admin)

1. **Entra admin center → App registrations → New registration**, e.g.
   "Objectways Talent – mailbox reader", single tenant. Note the
   **Application (client) ID** and **Directory (tenant) ID**.
2. **Certificates & secrets → New client secret.** Copy the secret value.
3. **Limit the app to consulting@ only.** Use Exchange Online *RBAC for
   Applications* (Exchange Online PowerShell):
   ```powershell
   New-ServicePrincipal -AppId <client-id> -ObjectId <enterprise-app-object-id> -DisplayName "Objectways Talent"
   New-ManagementScope -Name "Talent mailbox" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'consulting@objectways.com'"
   New-ManagementRoleAssignment -App <client-id> -Role "Application Mail.Read" -CustomResourceScope "Talent mailbox"
   Test-ServicePrincipalAuthorization -Identity <client-id> -Resource consulting@objectways.com
   ```
   Don't also grant the tenant-wide Microsoft Graph **Mail.Read** application
   permission in Entra. That consent would apply to every mailbox and
   override the scope above.
4. Set these Railway variables on the app service: `MS_TENANT_ID`,
   `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `INBOX_MAILBOX`
   (`consulting@objectways.com`) and `ANTHROPIC_API_KEY`. Redeploy.

`CRON_SECRET` (32+ random characters) must be the same on the app service and
the `inbox-sync` cron service.

Not built yet: email notifications (admins see a pending count in the
header instead), password reset (an admin can disable the account and the
person re-registers), and SSO. When adding SSO, keep the `Session` shape:
the pages only read `role`.
