# Submission

## Links

- **GitHub repository:** https://github.com/Tanmay-Butta/Sales-crm
- **Live application:** https://busy-sales-crm.vercel.app
- **Backend health check:** https://sales-crm-backend-90678443497.asia-south1.run.app/api/health

## Notes for the reviewer

The backend runs on Google Cloud Run (serverless container), which can sleep when idle. I set up a cron heartbeat that pings `/api/health` to keep the container warm — so in most cases the app loads fast. If you happen to catch it right after a cold restart, the first request may take ~30 seconds; everything is instant after that.

For multi-role testing: I use `sessionStorage` instead of `localStorage` for JWT tokens, so you can open two browser tabs side-by-side — one as **Mike Manager** and one as **Alice Rep** — and test permissions, reassignments, and collaboration without sessions interfering with each other. This was a deliberate choice after I ran into tab-collision bugs during early RBAC testing (documented in `docs/decisions.md`, Decision 1).

The repo includes 49 automated tests covering all 10 goals (`python backend/run_tests.py`), all passing. The git history has 65 commits across 16 feature branches — I committed incrementally as I built, not in one pass at the end.

There's also a `unlocked/testing` branch with a frontend build where all role restrictions are unlocked — handy if you want to quickly poke around the backend and test endpoints and backend RBAC.

One design decision worth calling out: the spec didn't explicitly say whether a company owner should see all deals under their company. I decided they should — a company owner is accountable for everything happening under that company, so they get read-only visibility into all its deals even if they don't own or collaborate on them. They can't modify those deals, just see them. This felt like the natural expectation in a real sales org.

---

## Demo credentials

The database is pre-seeded with realistic data: 18 companies, 40+ deals across every lifecycle stage, overdue items for alert testing, collaborator relationships, and a full immutable audit trail. All accounts use the password `password123`.

| Role | Email | Password |
|------|-------|----------|
| **Sales Manager** | `manager@test.com` | `password123` |
| **Sales Rep** | `alice@test.com` | `password123` |
| **Sales Rep** | `bob@test.com` | `password123` |
| **Sales Rep** | `charlie@test.com` | `password123` |
| **Sales Rep** | `diana@test.com` | `password123` |

**What to try:** Log in as the manager to see the full pipeline, bulk-advance some deals, reassign ownership, reopen a closed deal, and export CSV. Bulk actions (Bulk Advance, Bulk Reassign) appear in a floating toolbar at the bottom when you select multiple deals using the checkboxes. Then log in as Alice in another tab to see the same pipeline scoped down to only what she owns or collaborates on — the difference is immediate.

---

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Frontend** | React 18 + Vite, Axios, Lucide Icons, CSS | Vite for fast iteration. React for modular component reuse across complex modals (timeline, collaboration, bulk actions). Custom Axios interceptors log network latency and render cycle times in dev console. |
| **Backend** | Python 3.11, Flask, SQLAlchemy, Alembic, Flask-JWT-Extended, Marshmallow, Gunicorn | Clean, explicit, readable. Organized into routes → schemas → services → models. All business rules (lifecycle state machine, visibility, RBAC) live in the service layer, not scattered across routes. |
| **Database** | PostgreSQL (Supabase) | ACID transactions, foreign key constraints, unique indexes, and `Numeric(15,2)` for money — no floating-point rounding. |
| **Hosting** | Vercel (frontend) + Google Cloud Run (backend container) + Supabase (database) | Containerized deployment with automated HTTPS, scale-to-zero on free tiers, secrets in environment variables. |

---

## Goal checklist

| # | Goal | Status | What I actually built |
|---|------|--------|-----------------------|
| 1 | **Accounts and roles** | Done | JWT auth with `sessionStorage` tab isolation. Two roles (`SALES_MANAGER`, `SALES_REP`) enforced on every API endpoint via `@auth_required` and `@manager_required` decorators. No public signup — managers provision reps through a gated endpoint that hardcodes the role server-side. |
| 2 | **Companies** | Done | Full CRUD with owning rep. Case-insensitive duplicate detection that blocks reps with an informative message ("*Google already exists, owned by Alice Rep*") and gives managers a confirmation override. Manager-only soft archival that hides companies without destroying deals. |
| 3 | **Deals inside companies** | Done | `Numeric(15,2)` for deal values. Every deal tied to exactly one company and one owning rep. Opening a company shows its deals filtered by the current user's visibility, with access-provenance badges showing *why* each deal is visible. |
| 4 | **Deal lifecycle with rules** | Done | Single declarative transition table in `constants.py`. Strictly 1-step forward, 1-step backward with mandatory reason, terminal closure only from Negotiation. Manager-only reopen restores exact pre-closed stage — if `previous_stage` is missing, the system raises `INVARIANT_VIOLATION` instead of silently guessing. |
| 5 | **Collaborators** | Done | Owner or manager can add/remove reps. Managers are excluded (already have universal access), owners can't self-add (already have full rights). Dedicated "My Deals" page uses a separate query (`get_my_deals_query`) so company-owned deals don't clutter a rep's personal workload. |
| 6 | **Finding deals** | Done | 100% server-side: text search across deal title + company name, multi-criteria filters (company, stage, owner, view mode), server-side sorting (value, close date, last update), and paginated results with accurate total counts. Nothing loaded into the browser and filtered client-side. |
| 7 | **Bulk actions** | Done | Bulk advance with an interactive modal for Negotiation deals (Keep / Won / Lost). Bulk reassign with optional "keep previous owner as collaborator". Per-deal success/error reporting — the batch never fails all-or-nothing. CSV export with formula injection sanitization (CWE-1236). At 100× scale, I'd move the synchronous batch loop to an async job queue. |
| 8 | **Dashboard** | Done | Open deals count, weighted pipeline value (`value × stage probability`), deals won/lost this month, breakdown by stage and owner, and 8-week deals-won chart. All computed server-side from the same visibility rules used everywhere else. |
| 9 | **History you cannot rewrite** | Done | Append-only `deal_history` table. Logs creation, every stage change (with backward reasons), owner reassignments, collaborator adds/removes, notes, and deletions. No update or delete endpoints exist. JSON snapshots in `old_value`/`new_value` preserve point-in-time data even if names change later. |
| 10 | **Past-due alerts** | Done | Overdue = expected close date has passed and deal is still open. Navigation badge with live count. Dismissal stores `alert_dismissed_for_date` — not a boolean — so if the date gets pushed back and passes again, the alert resurfaces automatically. Only owner or manager can dismiss. |

---

## How much time did you actually spend?

About **15.5 hours** across the week, in focused 2–3 hour sessions:

- **Planning & schema design (~2h):** Read the spec multiple times. Sketched the state machine graph on paper. Mapped out the visibility asymmetry (company ownership ≠ deal access) before writing code.
- **Auth, RBAC & companies (~2.5h):** Flask structure, SQLAlchemy models, Alembic migrations, JWT auth. Hit the `localStorage` tab-collision bug here and switched to `sessionStorage`.
- **Deals, lifecycle & audit trail (~3h):** This was the biggest underestimate. The transition table was simple, but testing every illegal move and the reopen invariant took real time. Caught a bug where AI-generated code silently defaulted `previous_stage` to Negotiation — changed it to fail loudly instead.
- **Collaborators & centralized visibility (~2h):** Built `visibility_service.py` so every screen uses the same access rules. The tricky part was the asymmetry: owning a company shows all its deals, but collaborating on one deal should *not* leak the company's other deals.
- **Search, bulk ops & CSV (~2h):** Server-side search/filter/sort, atomic bulk operations with per-deal results, and CSV export with formula injection escaping.
- **Dashboard, alerts, tests & deployment (~4h):** Dashboard aggregations, past-due alert logic with date-tracked dismissal, 49 automated tests, Dockerfile + Cloud Run deployment, seed data, and the heartbeat scheduler.

---

## What would you do next, with another 12 hours?

1. **Real-time updates (WebSockets / SSE):** When a manager reassigns a deal, the rep's dashboard should reflect it without a manual refresh.
2. **TanStack Query on the frontend:** Replace manual `useEffect` + local state with proper query caching, optimistic updates, and automatic background sync.
3. **Bulk operation optimization:** Batch-fetch deals with `Deal.id.in_(ids)` and eager-loaded relationships in one query instead of N+1 sequential fetches. For very large batches, offload to an async worker queue (Celery/Redis) with progress tracking.
4. **Email activity logging & follow-up tasks:** Let reps log customer emails and schedule follow-up reminders directly on the deal timeline.
5. **Territory-based lead routing:** A rule engine for managers to auto-assign new companies to reps based on industry or deal size.

---

## What are you least happy with in this codebase, and why?

1. **Frontend state management is manual and repetitive.**
   After every action (adding a note, advancing a stage, closing a deal), the frontend either re-fetches the full list or does an in-place state update. Both approaches work, but doing this with raw `useState` + `useEffect` across multiple pages creates a lot of boilerplate. I ran into real bugs here — "zombie rows" that stayed visible after a filter-breaking action, and nested objects like `company.name` disappearing when partial API responses overwrote local state. A library like TanStack Query would handle this much more cleanly.

2. **Bulk operations hit the database one deal at a time.**
   The bulk advance and reassign endpoints loop through deal IDs sequentially to apply rules and build per-deal success/error reports. This is correct and handles edge cases well (closed deals, invalid transitions), but for 500+ deals it would be slow. I'd refactor to batch-fetch with `IN (...)`, validate in memory, and commit in one transaction.

3. **Some UI patterns are still page-level instead of shared components.**
   The timeline modal, collaboration modal, and bulk action patterns are repeated across DealsPage, MyDealsPage, and CompaniesPage with slight variations. I'd extract these into shared components to reduce duplication and make future UI changes easier.
