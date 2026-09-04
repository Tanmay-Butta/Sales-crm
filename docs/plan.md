# Plan

## How did you break the work into sessions?

Before writing much code, I spent some time reading the README properly. I read it a few times because the main features were easy to understand, but the important parts were often in the smaller rules after them.

For example, "deal stages" sounds simple at first. But once I looked closer, it actually meant a deal cannot skip a stage, can only move one step backward, needs a reason when moving backward, and becomes closed after Won/Lost. I wanted to understand those rules before building the UI around them.

I also used AI quite a lot while planning, mostly to question my assumptions and edge cases rather than just generate code. I would ask questions like:

> "If a manager reassigns a deal to another rep, what should happen if that rep doesn't own the company?"

or:

> "Can a collaborator delete a deal, or should delete be restricted to the owner?"

I thought about all the options and picked the one that felt right — comparing outputs from Gemini, Claude, and GPT against my own understanding of what a well-governed CRM should do.

The README does not explicitly answer every one of these cases, so I made decisions where needed and tried to keep those decisions consistent throughout the project.

I split the work into five main sessions:

- **Session 1 — Foundations:** authentication, roles, companies and deals.
- **Session 2 — Lifecycle & history:** stage rules, backward reasons, closing/reopening and immutable history.
- **Session 3 — Collaborators & visibility:** collaborator permissions and making sure reps only see the deals they should see.
- **Session 4 — Search and bulk actions:** server-side search/filtering, pagination, bulk actions and CSV export.
- **Session 5 — Dashboard, alerts and deployment:** reporting, past-due alerts, seed data, documentation and deployment.

The main reason for this order was dependency. I wanted the data and permissions to be correct before building features that depend on them. For example, building the dashboard before the deal lifecycle was stable would have meant building reports on data that might not be valid yet.

---

## What order did you build in, and why that order?

I started with authentication because everything else depends on knowing who the current user is and what role they have.

After that, I built companies and deals so I had the basic data and relationships in place. Once I had deals working, I added collaborators. Initially, I thought collaborators would be a small feature and could be done later, but while working on the permissions I realized that deal ownership, company ownership, and collaborator access are connected. I wanted to get those permissions clear before moving further.

For example, a rep might own a company but another rep could own a deal under that company. The company owner can see the company and its deals, but that does not automatically mean they can edit every deal. The deal owner or a collaborator should be the one who can update it. Thinking through cases like this helped me make the authorization rules more precise instead of just adding permissions wherever they were needed.

After collaborators, I worked on the deal lifecycle because it is one of the strictest parts of the README. I kept the lifecycle logic in one state-machine service instead of letting different routes decide whether a stage change is valid.

For example:

`New -> Qualified` → allowed

`New -> Proposal` → rejected

`Proposal -> Qualified` → allowed only with a reason

Keeping this logic in one place made the rules easier to test and also reduced the chance of different parts of the application behaving differently.

I also kept deal visibility in one shared place (`visibility_service.py`). This was important because the same visibility rules are needed in the Deals page, dashboard, CSV export, and search. If any of those used a different filter, a rep could see different deal counts on different screens. Having one rule made it easier to keep the results consistent.

I left search, bulk actions, dashboard and alerts until later because they depend on the deal data and permissions already being correct. My approach was to first make the foundation and rules reliable, and then build the features that depend on them.

A few questions kept coming up while building, and answering them shaped the design:

- *"Can a rep edit another rep's company?"* — The UI hides companies the rep shouldn't see, but that isn't enough. I tested the API directly with another rep's token to make sure the backend rejected it too. This was where I started treating the frontend as the interface and the backend as the actual source of truth.
- *"How do I test something the UI doesn't allow?"* — For example, the company owner dropdown only shows sales reps, so I couldn't use the normal UI to test an invalid `owner_id`. I used Thunder Client to send requests directly to the backend. I also created a separate `unlocked/testing` branch where I exposed all UI actions to verify the backend was enforcing rules independently.
- *"What should happen if `previous_stage` is missing?"* — My first reopen implementation assumed Negotiation. After testing, I realized guessing would hide a data problem. I changed it to fail with `INVARIANT_VIOLATION` instead — corrupted state should be loud, not invisible.

---

## What did you estimate versus what it actually took?

- **Project setup + authentication**
  - Estimated: **1.5h** → Actual: **2h**
  - Setup was straightforward, but authentication took longer once I started testing multiple users. I ran into a browser token-storage issue while testing Manager, Rep1 and Rep2 in different tabs — `localStorage` caused sessions to overwrite each other. Switching to `sessionStorage` fixed it, but meant rethinking how the auth context initializes on page load.

- **Companies CRUD + archival**
  - Estimated: **1.5h** → Actual: **2h**
  - The basic CRUD was quick. Most of the extra time went into ownership and authorization. I had to think through questions like *"Can Rep1 access Rep2's company?"* and then verify it through the API as well as the UI.

- **Deals + lifecycle**
  - Estimated: **2h** → Actual: **3h**
  - This was the biggest underestimate. The transition table itself was 30 lines. But testing every illegal combination (skip forward, double backward, close from wrong stage, reopen without `previous_stage`) took 10× longer than writing the table. I also caught a real bug where a missing `previous_stage` caused reopen to fall back to Negotiation. I changed it to fail instead of silently guessing the wrong stage.

- **Collaborators + visibility**
  - Estimated: **2h** → Actual: **2.5h**
  - The hardest part was making sure the visibility rule stayed correct everywhere. A rep should see their own deals and deals they collaborate on, but not unrelated deals. The same `visibility_service` query powers the deals page, dashboard, CSV export, and search — making sure they all go through one function took discipline.

- **Total for Goals 1–5**
  - Estimated: **7h** → Actual: **9.5h**
  - I went over the estimate, but most of the extra time was spent finding and fixing edge cases rather than adding unnecessary features.

The main thing I learned here was that the "small" features were not always actually small. The CRUD itself was usually quick. The time went into deciding what should be allowed, what should happen when something goes wrong, and then checking that the backend really enforced it.

- **Goal 6 — Search, filter and pagination**
  - Estimated: **1.5h** → Actual: **1.5h**
  - The search and filters themselves were not too bad. I built server-side search across deal title and company name, added filters for stage, owner, and company, and wired up pagination. The part that took extra time was making sure the filters work together properly — like if you search "cloud" and also filter by stage "PROPOSAL", both should apply at the same time. Also had to handle multi-company filtering because the spec allows filtering by multiple companies at once. I tested it with Postman too, not just the UI, because I wanted to make sure the query parameters actually worked correctly on the backend.

- **Goal 7 — Bulk actions and CSV export**
  - Estimated: **2h** → Actual: **2.5h**
  - The bulk advance looked simple on paper — select some deals, click advance, done. But then I realised what happens when your selected deals include some in Negotiation. You can't just blindly advance those because Negotiation is the last stage before closing. So I had to build an interactive modal that checks if any selected deals are in Negotiation and asks the user what to do — keep them as is, mark as won, or mark as lost. Then bulk reassign had its own set of problems. The backend had to reject managers as deal owners (a manager can reassign deals but cannot be the owner themselves). I also added a "keep previous owner as collaborator" option because when you reassign a deal, the old rep usually still needs access. CSV export was the easiest part — it just uses the same filters and search that are already active on the page. One bug I caught was that selection state was not resetting when filters changed. So you'd select 5 deals, change a filter, and the UI still showed "5 selected" even though those deals were no longer visible. Fixed that with a useEffect that clears selection on any filter/search/page change.

- **Goal 9 — Deal history and timeline**
  - Estimated: **1h** → Actual: **1.5h**
  - Most of the groundwork was already done from earlier sessions. The `deal_history` table was already immutable and append-only, and every stage change, owner change, collaborator add/remove, and note was already being logged. What I mainly did here was build the timeline UI on the deal detail page and make sure timestamps display correctly in IST. The history entries were already being created by the service layer, so this was more of a frontend task. Tested it by doing a bunch of actions on a deal and checking the timeline showed everything in order.

- **Goal 8 — Dashboard**
  - Estimated: **1.5h** → Actual: **2h**
  - The backend aggregation was straightforward once I built on top of `visibility_service.get_visible_deals_query(current_user)`. It computes the 4 headline numbers (open deals count, weighted pipeline value summing probability × value for open deals only, and deals won/lost within the current calendar month) and the breakdowns by stage and owner in a single round-trip. The 8-week deals won chart needed careful logic so all 8 consecutive weeks are present and zero-win weeks don't get omitted. On the frontend, I focused on making the glassmorphism UI clean and subtle, using Indian Rupees (`₹`), and fixing layout widths so nothing overflows or cuts off.

- **Goal 10 — Past-due deal alerts**
  - Estimated: **1h** → Actual: **1.5h**
  - I derived alerts directly from the `deals` table instead of creating an extra database table, which prevented data sync issues. Using `alert_dismissed_for_date = expected_close_date` made dismissal stateless and reliable: if the deal's expected close date is later rescheduled and that new date passes while the deal is still open, the alert naturally returns without needing background cron jobs. Enforced permissions on the backend so only the Deal Owner or a Sales Manager can dismiss (collaborators receive 403 Forbidden). On the frontend, added the active alerts page with quick rescheduling and wired up the navigation sidebar badge so it updates dynamically whenever deals are closed, advanced, or rescheduled.

- **Deployment & production infrastructure**
  - Estimated: **1h** → Actual: **1.5h**
  - Deployed the backend on Google Cloud Run using Cloud Build for automated container builds, and Supabase PostgreSQL for the database. Ran migrations against the remote instance, then wrote a sync script to transfer all test data (companies, deals, collaborators, audit history) from local testing directly into Supabase, resetting primary key sequences afterwards. Configured a production Dockerfile with Gunicorn bound to `$PORT`, added `.dockerignore`, deployed to `asia-south1` with public HTTPS, and verified health + auth endpoints live.

---

## What did you cut when you ran short?

I tried to avoid cutting anything that was part of the ten required goals. Instead, I cut things that were either optional or mainly visual.

**Public signup** — I did not build a public signup page. The assignment requires email/password authentication but does not require public user registration. Users are provisioned internally by managers.

**Real-time collaboration** — I considered WebSockets so that another user could instantly see a deal update. I decided against it because real-time syncing is not required for the CRM workflow and would add complexity without helping me complete the required goals.

**Extra UI polish** — I prioritised correct permissions, lifecycle rules, validation and server-side behaviour over animations and micro-interactions. The UI is functional and responsive, but some areas could use another pass.

**Stretch goals** — I left the stretch features until the required functionality was complete rather than using them to fill time while core requirements were unfinished.