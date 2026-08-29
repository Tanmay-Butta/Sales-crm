# Assignment 14 — Sales CRM

## The scenario

Picture a small sales team — a handful of reps, each juggling a couple dozen live deals with
different companies at any time — and a sales manager trying to keep the whole pipeline honest.
Right now, deals live in each rep's head and a shared spreadsheet that gets updated whenever someone
remembers, with every rep tracking stage a little differently: one uses a column, another just types
notes into a comments cell.

The result is predictable. A deal quietly sits in the same stage for a month and nobody notices until
the manager asks the rep directly. Two reps end up working the same company because neither knew the
other had already reached out. A deal marked lost gets deleted from the sheet entirely, so nobody can
ever explain afterward why it fell through. Asking what the pipeline is actually worth this quarter
means opening the spreadsheet and building a formula by hand.

They want one system: a sales manager sees the whole pipeline and can step in to reassign a stalled
deal, and reps manage their own companies and deals through a defined set of stages that cannot be
skipped or quietly rewritten. Anyone should be able to answer "what is the pipeline actually worth
right now" without opening a spreadsheet. That is the tool you are building.

## What it must do

Everything below is required. Several of the ten spell out exact rules — what happens on an illegal
move, what a bulk action must report back, when a dismissed alert is allowed to reappear — and those
specifics are the actual ask, not just the bold headline in front of them.

1. **Accounts and roles.** People sign in with an email and password, and there are at least two
roles — a sales manager role and a sales rep role. Sales managers create and archive companies, can
see and act on every company and deal, reassign a deal to a different owner, and reopen a closed
deal. Sales reps create companies and deals, act on deals they own or collaborate on, and can see
only the companies and deals they own or collaborate on. The difference must be enforced on the
server, not just hidden in the interface.

2. **Companies.** Sales reps and managers create companies with a name, an industry, a website, and
an owning sales rep, and can edit them later. Companies can be archived and restored. Archiving hides
a company from the default views without destroying its deals.

3. **Deals inside companies.** Every deal belongs to exactly one company and carries a title, a
value expressed as an exact decimal amount, an expected close date, and an owning sales rep. Deals
can be created, edited, and deleted. Opening a company shows its deals.

4. **A deal lifecycle with rules.** A deal advances *New → Qualified → Proposal → Negotiation*, and
from Negotiation is marked *Won* or *Lost*; each stage carries a fixed win-probability used to weight
the deal's value for reporting. A deal can move backward exactly one stage at a time, such as
Negotiation back to Proposal, and doing so requires a recorded reason. A deal is open until it
reaches Won or Lost, at which point it closes to further stage changes; a sales manager can reopen a
closed deal, which returns it to the stage it was in immediately before it closed. Any other move —
including skipping a stage forward, moving back more than one stage at a time, or changing the stage
of a closed deal without reopening it first — must be rejected by the server with a message
explaining why.

5. **Collaborators.** A deal has one owner, but any number of other sales reps can be added to it as
collaborators who can also update it, and a single sales rep can collaborate on any number of deals.
Only a sales manager or the deal's owner can add or remove a collaborator. Every sales rep can see
one list of every deal where they are the owner or a collaborator.

6. **Finding deals.** One list shows deals across every company the viewer can see, with a text
search over deal title and company name, filters for company, stage and owner, sorting by value,
expected close date or last update, and pagination showing the total number of matches. All of this
must happen on the server — do not load every deal into the browser and filter there.

7. **Acting on many deals at once.** Sales managers can bulk-reassign selected deals to a different
owner, or bulk-advance them to the next stage, in a single action. Because some deals in the
selection will not be eligible — a closed deal cannot advance, for instance — the result reports per
deal what succeeded and what was rejected and why, not just fail the whole batch. Separately, export
the pipeline — every open deal with its company, stage, value and stage-weighted value — as a CSV
file.

8. **A dashboard.** A landing view shows headline numbers — open deals, weighted pipeline value,
deals won this month, and deals lost this month. It also breaks open deals down by stage and by
owner, and charts deals won per week over the last eight weeks.

9. **History you cannot rewrite.** Every deal has a timeline showing when it was created, every
stage change with the old and new stage, its reason if moving backward, and who made it, every owner
reassignment, and any notes left on it. Nothing in this timeline can be edited or deleted after the
fact, including by sales managers.

10. **Past-due deal alerts.** Any open deal whose expected close date has passed appears in an
alerts area, with a count badge visible in the navigation. The deal's owner can dismiss the alert. If
the expected close date later changes and then passes again while the deal is still open, the alert
returns.

## Stretch ideas (optional)

None of these are required, and none substitute for a goal above. If you finish all ten with time
left over, pick whichever of these sounds most useful and build it:

- Email integration that logs correspondence per deal.
- Quote or proposal document generation.
- Territory-based company assignment rules.
- Quarterly forecasting reports.
- Custom fields per company or deal.
- Task and follow-up reminders per deal.
- Lead scoring before conversion to a deal.
- Duplicate company detection on creation.
- Commission calculation based on won deals.


---

## What we are assessing

A working application is table stakes. Almost every serious candidate will produce something that runs, has a login, and roughly does what was asked. That's the floor, not the differentiator.

What actually separates submissions is the record of thinking behind the app: the decisions you made and why, the trade-offs you weighed, what you built first and what you deliberately left out, and whether you can explain any part of your own system when asked. We are hiring for judgement. The app is the evidence for that judgement, not the deliverable in itself.

We also read the code itself for structure and readability, which counts for a small share of the overall score.

## Time budget

Budget about 12 hours total, spent roughly 2 hours a day across a week.

This is not a race. We are not timing you against other candidates, and submitting early scores nothing extra. Twelve hours is a size guide so you know how much to attempt — pace yourself, stop when you're tired, and spend some of that time thinking and documenting, not only typing code.

## Pick any stack you like

Use any language, any framework, any UI library, any ORM, and any database access approach you want. We have no house stack, and no stack scores better than another — this round is not a test of whether you know particular tools.

Use whatever you are fastest and most confident in. Time spent learning something new to impress us is time not spent on the ten goals above, and it will show.

## Using AI is allowed and encouraged

Use AI tools however you want — to scaffold code, debug a stuck problem, write tests, draft documentation, or anything else that helps you move faster. A few things to know about how we treat it:

- We do not penalise AI use, and we make no attempt to detect it.
- We care about whether you understood, directed and verified the output — not about who or what produced the first draft of it.
- `docs/ai-prompts.md` must contain the prompts you actually used, including the ones that produced bad output and what you changed afterwards. If you used no AI at all, say so here and describe how you worked instead — that is assessed the same way.
- Submitting generated code you cannot explain is the single most common way candidates fail this round.

You are accountable for everything in your submission. If a reviewer points at a piece of code and asks why it's there, or why it works the way it does, "the AI wrote it" is not an answer.

## Use git properly

Publish to a public GitHub repository, and commit incrementally as the work actually happens — after each meaningful step, not in one pass at the end.

A repository whose entire history is a single "initial commit" containing a finished app scores zero on git history, and it colours how we read everything else in your submission, however good the app itself is. Your history is how we see the order you built in, where you got stuck, and how the design changed along the way. If it isn't there, we can't assess it, and we won't assume the best.

## What you must commit

Alongside your code, commit these five files under `docs/`. Your zip includes a stub for each with the questions it needs to answer — fill them in as you go, not from memory at the end.

| File | What it must answer |
|------|----------------------|
| `docs/architecture.md` | What the moving pieces are, how they talk to each other, where each one runs, the request path for one representative user action end to end, and what you decided not to build. |
| `docs/schema.md` | Every table's columns and types, which relationships are one-to-many versus many-to-many, which constraints live in the database versus the application, what you deliberately denormalised, and what would break first at 100x the data. |
| `docs/plan.md` | How you split the work into sessions, what order you built in and why, what you estimated versus what it actually took, and what you cut when you ran short. |
| `docs/decisions.md` | At least five real decisions — what you chose, what you rejected, and why — including at least one you later reversed. |
| `docs/ai-prompts.md` | The prompts you actually used, in order, grouped by what you were trying to do, including at least one that produced something wrong and what you did about it. |

## Host it for free

Deploy the whole thing somewhere reachable by URL, using free tiers only.

One combination that works, if you would rather not decide:

- **Database** — a managed service such as Supabase.
- **Server-side code** — Render.
- **Browser-side code** — Vercel.

Deploy in that order: create the database first, give the server its connection details as environment variables, then point the browser-side part at the server's public URL.

This is one option, not a requirement. Any free host is equally acceptable — everything on a single provider, one virtual machine, a container platform, a static host with serverless functions. The choice earns and loses nothing.

Requirements:

- A working live URL.
- Seeded with enough demo data to show the system doing something, not an empty shell.
- Demo credentials for every role recorded in `SUBMISSION.md`.
- Connection strings, keys and passwords kept in environment variables, never in the repository.
- Free tiers often sleep when idle and can take a minute or more to wake. Note it in `SUBMISSION.md` if yours does, so a slow first load is not read as a broken deployment.
- If you cannot get it hosted, submit anyway and record in `SUBMISSION.md` what you tried and where it broke.

## How to submit

Send us:

- The URL of your public GitHub repository.
- The URL of your live, deployed application.
- Your completed `SUBMISSION.md`, committed to the repository.

That's the whole submission. Nothing else to prepare, no separate form.

## What happens next

If your submission clears the bar, we'll set up a short call. We will ask about specific decisions we can see in your repository and its history — why you modelled something a particular way, what a certain commit was fixing, what you'd change if you kept going.

We're telling you this now because it should change how carefully you document as you go. Write `docs/decisions.md` for a version of yourself who has to explain it three weeks from now.

## Scope

The 10 goals stated in this brief are the cutoff. Meet all 10, solidly, and you have a complete submission.

Stretch ideas are optional. They exist for candidates who finish the 10 with time left and want to keep building — they are never required, and they do not make up for a goal you didn't hit. Doing 8 goals well beats doing 10 goals badly. If time is short, finish fewer goals properly rather than leaving all ten half-done.
