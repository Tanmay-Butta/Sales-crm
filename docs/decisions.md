# Decisions

Log the decisions that actually shaped this codebase — the ones where a real alternative existed and
you picked one. At least five entries. For each: what you chose, what you rejected, and why. At least
one entry must be a decision you later reversed — say what changed your mind.

## Decision 1: Session Storage over Local Storage for JWT Auth
- **Chose:** Storing JWT tokens and authenticated user state in `sessionStorage`.
- **Rejected:** Using `localStorage` or server-set HTTP-only cookies without tab separation.
- **Why:** In real-world enterprise CRM evaluation and daily sales operations, testing and switching between different roles (Sales Manager vs Sales Reps) simultaneously in side-by-side browser tabs is essential. `localStorage` synchronizes across all browser tabs, causing logins in one tab to silently overwrite active sessions in another tab, leading to confusing 403/401 errors. `sessionStorage` provides complete tab isolation while remaining straightforward to implement.
- **Later reversed:** Initially implemented authentication using `localStorage` during initial scaffolding, but reversed to `sessionStorage` as soon as multi-role RBAC testing began across tabs.

## Decision 2: Company vs Deal Visibility Asymmetry (Centralized Visibility Model)
- **Chose:** Centralizing all visibility filtering in `visibility_service.py` with asymmetric rules:
  1. Owning a company grants visibility to *all* deals in that company.
  2. Owning or collaborating on a deal grants implicit read-only visibility to the *parent company*, but only grants visibility to *their own deals* within that company (not teammates' deals).
- **Rejected:** Symmetric visibility ("if you can see the company, you can see all deals inside it") and manual ad-hoc filtering across different route handlers.
- **Why:** The README states reps only see companies/deals they own or collaborate on. If a manager reassigns a deal to Rep B under a company owned by Rep A, Rep B needs to see the company to know whom they are selling to, but Rep B should not see other unrelated deals owned by Rep A in that company. Centralizing this logic into one shared service prevents discrepancies between global search, company pages, and reporting.

## Decision 3: Narrow "My Deals" vs Wide "Visible Deals" Query Separation
- **Chose:** Implementing `get_my_deals_query()` as strictly `owner_id == user.id OR user in collaborators`, completely separate from `get_visible_deals_query()` which also includes company-owned deals.
- **Rejected:** Reusing the same deal list query for both the global search/dashboard and the personal "My Deals" page.
- **Why:** Spec §5 requires a personal list of every deal where a rep is an owner or collaborator. A rep who owns an overarching company account but is not an owner/collaborator on an individual teammate's deal should not have their personal daily workload queue cluttered with that deal.

## Decision 4: Strict Collaborator Scoping & Blocking Owner Self-Collaboration
- **Chose:** Enforcing server-side validation that collaborators must be `SALES_REP`s, cannot be the deal's primary owner, and cannot be added by anyone other than the deal owner or sales manager.
- **Rejected:** Allowing managers as collaborators or allowing deal owners to add themselves as collaborators.
- **Why:** Managers already have unrestricted access to all deals across the platform; adding them to collaborator lists produces redundant records and pollutes team lists. Similarly, a deal's primary owner already has full rights; adding them as a collaborator creates ambiguous permission states and data duplication.

## Decision 5: Collaborator Audit Trail Logging Extension
- **Chose:** Logging `COLLABORATOR_ADDED` and `COLLABORATOR_REMOVED` events into the immutable `deal_history` table alongside `DEAL_CREATED` and `OWNER_CHANGED`.
- **Rejected:** Only logging stage transitions and owner reassignments.
- **Why (Intentional Extension):** While spec §9 explicitly mandates stage changes and owner reassignments, logging collaborator modifications adheres to the core philosophy of "History you cannot rewrite". Sales reps frequently collaborate on high-value enterprise deals; maintaining an immutable record of team member additions and removals provides accountability and prevents disputes over deal credit.

## Decision 6: Explicit Access Provenance & Relationship Labeling in UI
- **Chose:** Providing dedicated "Your Access / Source" provenance badges and filtering tabs across both Companies and All Deals (explicitly differentiating `Deal Owner`, `Collaborator`, `Company Owner (Via [Company Name])`, and `Manager Access`).
- **Rejected:** Rendering deals and companies without provenance context.
- **Why:** In an asymmetric visibility model, sales reps see deals and companies from multiple distinct access pathways (e.g., Rep Alice sees Rep Charlie's deal in "All Deals" because Alice owns the parent company *Acme Corp*, even though Alice is not on the deal itself). Without explicit provenance indicators, reps can become confused about why another rep's deal is visible to them or mistakenly assume a permission leak. Explicit access badges clarify the exact authorization path, highlight editability boundaries (read-only for company-owned deals vs editable for owned/collaborated deals), and maintain a professional enterprise CRM aesthetic.

## Decision 7: Case-Insensitive Duplicate Company Prevention with Manager Override
- **Chose:** Enforcing server-side uniqueness on company names (case-insensitive and whitespace-trimmed) on both company creation and company renaming, with strict blocking for Sales Reps and an explicit confirmation override for Sales Managers (`allow_duplicate: true`).
- **Rejected:** Permitting silent duplicate company names across different reps or hard-blocking managers without an override option.
- **Why:** The README specifically highlights the operational failure mode where *"two reps end up working the same company because neither knew the other had already reached out."* If Rep A owns *Google* and Rep B separately creates another *Google* account, the organization suffers from split communication, competing pitches, and commission conflicts. When a duplicate name is detected for a rep, the server rejects the request with an informative error message stating who already owns the account (e.g., *"A company named 'Google' already exists (owned by Alice Rep). Please coordinate with Alice Rep or a Sales Manager to collaborate."*). For Sales Managers, who may intentionally need to manage distinct legal entities with identical names, the system displays an explicit in-modal warning dialog requiring manager confirmation before creating the duplicate.

## Decision 8: Strict Sequential Lifecycle State Machine with Mandatory Backward Reasons
- **Chose:** A single declarative lookup table (`STAGE_TRANSITIONS`) enforcing strict one-step sequential forward progression (`NEW` -> `QUALIFIED` -> `PROPOSAL` -> `NEGOTIATION`), terminal closure to `WON`/`LOST` exclusively from `NEGOTIATION`, strict one-step backward movement with mandatory recorded explanation reasons, and complete blockage of direct stage edits via generic PUT endpoints.
- **Rejected:** Allowing arbitrary forward stage skipping (e.g., `NEW` -> `PROPOSAL`), closing deals directly from early stages without negotiation, or permitting backward stage demotions without an explanation note.
- **Why:** CRM sales pipelines represent a governed sales methodology. Unrestricted stage jumping distorts pipeline velocity and win-probability forecasts (e.g. counting a newly created lead as 75% weighted probability). Backward demotions indicate objections, scope reductions, or budget roadblocks; requiring a recorded explanation preserves the rationale in the deal's immutable timeline audit trail.

## Decision 9: Invariant-Preserving Reopening with Loud Failure on Corrupted State
- **Chose:** Preserving the pre-closing stage in `deal.previous_stage` upon closing, and requiring Sales Manager authorization to reopen closed deals directly back to `previous_stage` (clearing `closed_at` and `previous_stage`). If `previous_stage` is missing or corrupted, the system immediately raises an HTTP 500 `InternalError` with code `INVARIANT_VIOLATION`.
- **Rejected:** Silently guessing or defaulting the reopen target to `NEGOTIATION` when `previous_stage` is null.
- **Why:** Silently defaulting a corrupted state turns an underlying data-integrity bug into a hidden defect. If a deal was closed from an unexpected state or corrupted during a database migration, defaulting masks the issue and creates an invalid pipeline state. Raising a loud, debuggable `INVARIANT_VIOLATION` makes the failure explicit and prevents unverified state transitions.

## Decision 10: Flexible Deal Creation under Visible Companies (Account-Based Ecosystem)
- **Chose:** Allowing any sales rep to create a new deal under any company they have visibility into (e.g., if Bob collaborates on one deal for Company Beta, he can see Company Beta and therefore create a *new* deal under Company Beta).
- **Rejected:** Strictly locking down deal creation so that *only* the specific owner of a company can create new deals under it.
- **Why:** The `README.md` states "Sales reps create companies and deals" without explicitly restricting deal creation to the company's owner. In real-world enterprise CRMs (like Salesforce or HubSpot), an Account-Based Selling model is standard: a senior Account Executive owns the Company, but specialists or junior reps can uncover new opportunities, create new deals, and own those deals under the overarching account. The Company Owner benefits by retaining automatic visibility over all activity in their account. Locking this down would artificially force reps to create duplicate companies (e.g. "Beta LLC") just to log their deals, ruining reporting accuracy.

## Decision 11: Bulk Advance Stage Progression & Negotiation Outcome Resolution via Interactive Modal
- **Chose:** Designing `POST /api/deals/bulk-advance` with sequential forward advancement (`NEW` → `QUALIFIED` → `PROPOSAL` → `NEGOTIATION`) while handling `NEGOTIATION` deals through an interactive confirmation dialog with three explicit options:
  1. `Keep in Negotiation (Do not close) [Default]`: Advances early stage deals sequentially while preserving negotiation deals in their active state.
  2. `Mark as WON`: Closes `NEGOTIATION` deals as `WON`, setting `previous_stage='NEGOTIATION'`, recording `closed_at`, and logging a `DEAL_CLOSED` audit record.
  3. `Mark as LOST`: Closes `NEGOTIATION` deals as `LOST`, setting `previous_stage='NEGOTIATION'`, recording `closed_at`, and logging a `DEAL_CLOSED` audit record.
- **Rejected:** 
  - Arbitrarily forcing or guessing whether `NEGOTIATION` deals should be marked `WON` or `LOST` automatically.
  - Hard-failing the entire batch for negotiation deals if a selected deal is at `NEGOTIATION` useful in real life ig.
- **Why:** In our governed lifecycle state machine, `NEGOTIATION` is the critical bifurcation point where deals transition to terminal closed states (`WON` or `LOST`). Because closing a deal directly impacts quota, weighted pipeline forecasts, and revenue metrics, automatically defaulting deals to `WON` or `LOST` without user intent would risk severe reporting errors. Providing an explicit modal with a default of "Keep in Negotiation" allows managers to safely mass-advance mixed pipelines while deciding whether to close mature opportunities. Each deal is processed and committed atomically to satisfy the core requirement that bulk operations are never all-or-nothing.

## Decision 12: Bulk Reassignment Owner Role Enforcement & Collaborator Retention
- **Chose:** Enforcing server-side validation that bulk reassignments must target a valid `SALES_REP` (rejecting Sales Managers with a clear error: *"Deal owner must be a Sales Rep. Sales Managers cannot be deal owners"*), while providing an interactive checkbox in the modal: *"Keep previous owner(s) as collaborator(s)"* (defaulting to `true`).
- **Rejected:** Allowing deals to be assigned to Sales Managers, or silently stripping the previous rep's access when a deal is reassigned.
- **Why:** Sales Managers oversee the entire pipeline and do not carry individual deal quotas; assigning deals directly to managers distorts team ownership boundaries. Furthermore, when a manager reassigns deals between reps (e.g., rebalancing territory or transitioning enterprise accounts), the originating rep often needs to continue providing context and assisting on the opportunity. Retaining the former owner as a collaborator ensures zero disruption to deal momentum while logging `OWNER_CHANGED` and `COLLABORATOR_ADDED` events in the deal's immutable audit history.

## Decision 13: How Past-Due Alerts and Dismissals Work
- **Chose:** 
  1. Allowing only the deal's primary owner and the sales manager to dismiss an overdue alert. Collaborators cannot dismiss it.
  2. Remembering the exact date that was dismissed on the deal itself, instead of using a simple true/false flag or making a separate alerts table.
  3. Calculating whether a deal is overdue based on Indian Standard Time (IST).
- **Rejected:** 
  - Letting collaborators dismiss alerts on deals they don't own.
  - Using a permanent "dismissed = true" flag.
  - Creating a separate alerts database table that needs constant syncing.
- **Why:** 
  Goal 10 says the deal owner can dismiss the alert, while Goal 1 says managers can see and act on every deal. In a real sales team, if a rep is on leave or a manager is reviewing the team's pipeline, the manager needs to be able to acknowledge and clear the alert. But a collaborator who is just helping out on a deal shouldn't be dismissing notifications meant for the main owner.

  The reason for storing the dismissed date instead of a simple true/false flag comes down to the requirement in Goal 10: *if the close date changes and that new date passes again, the alert must return*. If you just flip a boolean flag to "dismissed", the system will never alert you again even if the deal is pushed back and missed a second time. By remembering *which* date was dismissed (e.g. Aug 15), if the rep later moves the date to Aug 25 and that date also passes, the system immediately notices that Aug 25 hasn't been dismissed yet and brings the alert right back. It's clean, simple, and avoids having to manage background timers or extra database tables.

---

### Assumptions & Business Rules
- **Company Archival**: Archiving a company is a soft-delete to preserve history. Existing deals belonging to an archived company remain intact and accessible according to normal deal visibility rules. However, creating a *new* deal under an archived company is blocked to avoid adding fresh pipeline to closed accounts.
- **Company Ownership Rule**: Company owners must always be Sales Reps, never Sales Managers (Managers oversee the whole pipeline but don't hold individual quota).
- **Alert Trigger Boundary**: Deals due today are considered on track; a deal becomes past-due only once its expected close date has actually passed. Closed deals (Won or Lost) and deleted deals never trigger alerts.


