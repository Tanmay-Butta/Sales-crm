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

---

### Assumptions & Business Rules
- **Company Archival**: Archiving a company is a soft-delete to preserve history. Existing deals belonging to an archived company remain intact and accessible according to normal deal visibility rules. However, creating a *new* deal under an archived company is rejected server-side to prevent accumulating new pipeline on dead accounts.
- **Company Ownership Rule**: Company owners must always be Sales Reps, never Sales Managers (Managers oversee the whole pipeline but don't hold individual quota).
