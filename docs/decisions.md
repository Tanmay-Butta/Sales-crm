# Decisions

## Decision 1: sessionStorage over localStorage for JWT auth

- **Chose:** Storing JWT tokens in `sessionStorage` so each browser tab has its own isolated session.
- **Rejected:** `localStorage` (shared across all tabs) or server-set HTTP-only cookies.
- **Why:** To test RBAC properly, I needed Manager and Rep open side-by-side in different tabs. `localStorage` syncs across tabs, so logging in as the manager in Tab A would silently overwrite Alice's token in Tab B, causing confusing 403 errors during permission testing.
- **Later reversed:** I initially built auth with `localStorage` during scaffolding. Reversed it to `sessionStorage` as soon as I started multi-role RBAC testing across tabs and sessions kept colliding.
## Decision 2: Company vs Deal Visibility Asymmetry (Centralized Visibility Model)
- **Chose:** Centralizing all visibility filtering in `visibility_service.py` with asymmetric rules:
  1. Owning a company grants visibility to *all* deals in that company.
  2. Owning or collaborating on a deal grants implicit read-only visibility to the *parent company*, but only grants visibility to *their own deals* within that company (not teammates' deals).
- **Rejected:** Symmetric visibility ("if you can see the company, you can see all deals inside it") and manual ad-hoc filtering across different route handlers.
- **Why:** The README states reps only see companies/deals they own or collaborate on. If a manager reassigns a deal to Rep B under a company owned by Rep A, Rep B needs to see the company to know whom they are selling to, but Rep B should not see other unrelated deals owned by Rep A in that company. Centralizing this logic into one shared service prevents discrepancies between global search, company pages, and reporting.

## Decision 3: Separate "My Deals" query vs "Visible Deals" query

- **Chose:** `get_my_deals_query()` only returns deals where the user is owner or collaborator. Completely separate from `get_visible_deals_query()` which also includes company-owned deals.
- **Rejected:** Reusing the same query for both the global pipeline and the personal "My Deals" page.
- **Why:** A rep who owns a company shouldn't have their personal workload cluttered with every teammate's deal under that company. "My Deals" should be strictly what they're directly responsible for — their own deals and deals they collaborate on.

## Decision 4: Fail-fast on missing production secrets

- **Chose:** The app factory checks `SECRET_KEY` and `JWT_SECRET_KEY` on startup. If either is missing or matches a known dev fallback when `FLASK_ENV=production`, the server refuses to start with a `RuntimeError`.
- **Rejected:** Silently falling back to hardcoded dev secrets like `'jwt-dev-secret-change-in-production'` in production.
- **Why:** If production env vars are accidentally deleted, an attacker could forge manager JWT tokens using the dev secret from the public source code. I'd rather have a deployment fail loudly than silently run production with zero effective authentication.

## Decision 5: Date-tracked alert dismissal instead of boolean flag

- **Chose:** Storing `alert_dismissed_for_date = expected_close_date` on the deal when dismissing an overdue alert.
- **Rejected:** A simple `dismissed = true` boolean flag, or a separate alerts table.
- **Why:** The spec says if the close date changes and that new date passes again, the alert must return. A boolean flag would permanently silence the alert. By storing which date was dismissed, if the rep moves the date from Aug 15 to Aug 25 and Aug 25 also passes, the system notices Aug 25 hasn't been dismissed yet and the alert comes back automatically. No background jobs needed.

## Decision 6: Loud INVARIANT_VIOLATION on corrupted reopen state

- **Chose:** If a closed deal is missing `previous_stage`, raise `InternalError` (HTTP 500) with code `INVARIANT_VIOLATION`.
- **Rejected:** Silently defaulting the reopen target to `NEGOTIATION` when `previous_stage` is null.
- **Why:** Defaulting masks a data-integrity bug. If a deal was closed from an unexpected state or corrupted during migration, silently guessing the wrong stage creates an invalid pipeline record. A loud 500 error is debuggable; a silent wrong stage is not.

## Decision 7: Case-insensitive duplicate company detection with manager override

- **Chose:** Server-side duplicate detection on company names (case-insensitive, whitespace-trimmed). Reps get blocked with an informative error ("*Google already exists, owned by Alice Rep*"). Managers get a warning dialog with a confirmation override.
- **Rejected:** Allowing silent duplicates, or hard-blocking managers without an override.
- **Why:** The README highlights the problem of two reps unknowingly working the same company. Blocking reps prevents that. But managers may legitimately need duplicate names for distinct legal entities, so they get an explicit override rather than a hard block.

## Decision 8: Soft-delete deals with read-only trash (no restore)

- **Chose:** Soft-delete (`deleted_at`) with an immutable `DEAL_DELETED` audit event. Manager-only read-only Trash view with no restore button.
- **Rejected:** Hard-deleting deals, or adding a "Restore Deal" button.
- **Why:** The spec says companies can be "archived and restored" but deals can only be "created, edited, and deleted" — restore is intentionally omitted for deals. Soft-delete satisfies deletion while preserving audit history. No restore means we respect the spec's distinction instead of adding an unrequested feature.

## Decision 9: Blocking owner self-collaboration and manager collaboration

- **Chose:** Server-side validation that collaborators must be `SALES_REP`, cannot be the deal owner, and cannot be managers.
- **Rejected:** Allowing managers or deal owners as collaborators.
- **Why:** Managers already have universal access — adding them to collaborator lists is redundant data. Deal owners already have full rights — self-adding creates ambiguous permission states. Both clutter the team list without adding value.

## Decision 10: CSV formula injection sanitization

- **Chose:** Prepending `'` to any dynamic text field (deal title, company name) starting with `=`, `+`, `-`, `@`, `\t`, or `\r` in CSV exports.
- **Rejected:** Writing raw strings directly to CSV and relying on spreadsheet apps to warn users.
- **Why:** When a manager opens a CSV export in Excel, cells starting with `=` are executed as formulas. A malicious deal title like `=cmd|'/C calc'!A0` could run commands. Prepending a single quote is the OWASP-recommended mitigation (CWE-1236) that forces the cell to render as plain text.
## Decision 11: Bulk Advance & Negotiation Handling

* **Chose:** Sequentially advance deals through `NEW → QUALIFIED → PROPOSAL → NEGOTIATION`.
* For `NEGOTIATION` deals, show a modal with:

  * **Keep in Negotiation** — default
  * **Mark as WON**
  * **Mark as LOST**
* **Rejected:** Automatically guessing `WON/LOST` or failing the entire batch because of negotiation deals.
* **Why:** Closing affects revenue and pipeline metrics, so explicit user intent is safer. Each deal is processed independently so valid deals are not blocked by others.

## Decision 12: Bulk Reassignment & Collaborators

* **Chose:** Only `SALES_REP` users can become deal owners; managers are rejected server-side.
* Added **“Keep previous owner(s) as collaborator(s)”**, enabled by default.
* **Rejected:** Assigning deals to managers or silently removing the previous owner's access.
* **Why:** Keeps ownership rules clear while preserving the previous rep's context and access. Changes are recorded in the deal history.

---

### Assumptions & Business Rules

- **Company archival** is a soft-delete. Existing deals under an archived company remain accessible, but creating new deals under it is blocked.
- **Company owners** must be Sales Reps, never Managers (managers oversee the pipeline but don't carry individual quota).
- **Alert trigger boundary:** deals due today are on track; a deal becomes past-due only once `expected_close_date < today`. Closed and deleted deals never trigger alerts.
- **Pre-dismissal prevention:** alerts can only be dismissed when an active past-due alert currently exists. Attempting to dismiss future-dated, closed, or already-dismissed deals is rejected with HTTP 422.
- **Bulk de-duplication:** duplicate deal IDs in bulk operations are processed once and rejected on subsequent occurrences to prevent multi-hop stage skipping.
