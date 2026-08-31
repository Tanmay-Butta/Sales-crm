# AI Prompts & Engineering Process Log

This document records the actual prompts, pre-implementation plans, AI outputs, and manual corrections made throughout the development of Goals 1 through 5.

---

## 1. Deal Lifecycle State Machine & Reopening Invariants (Goal 4)

### The Pre-Story Plan & Context
Before writing any code for the deal lifecycle, I sat down with pencil and paper to map out the entire state machine graph. The brief had strict invariant rules:
1. `NEW` → `QUALIFIED` → `PROPOSAL` → `NEGOTIATION` (strictly one step forward).
2. `WON` or `LOST` can only ever be reached from `NEGOTIATION`.
3. Backward moves must be strictly one stage at a time and require a mandatory non-empty reason.
4. Once closed, stage changes are blocked. Only a Sales Manager can reopen, which must return the deal to its exact pre-closed stage.

I wanted a single declarative transition matrix on the backend rather than scattered `if/else` checks across multiple route handlers.

### Prompt
```text
I need to implement the deal lifecycle state machine in backend/app/services/deal_service.py.
Stages: NEW -> QUALIFIED -> PROPOSAL -> NEGOTIATION -> WON / LOST.
Rules:
- Forward moves: strictly 1 stage at a time.
- Backward moves: strictly 1 stage at a time, reason is required.
- Won/Lost can only be reached from NEGOTIATION.
- Closed deals cannot change stage.
- Sales Manager can reopen a closed deal, restoring it to deal.previous_stage.
Please write validate_stage_transition(deal, target_stage, reason) and reopen_deal(current_user, deal_id).
```

### What AI Generated
The AI provided a lookup table and the transition logic. However, in `reopen_deal`, it wrote:
```python
# Restore previous stage or default to NEGOTIATION
target_stage = deal.previous_stage or Stages.NEGOTIATION
deal.stage = target_stage
deal.previous_stage = None
```

### What was Wrong & What I Corrected
**The AI introduced a silent data-corruption bug.** Defaulting `deal.previous_stage` to `NEGOTIATION` when it is `None` violates the invariant that a deal must return to the stage it occupied immediately before closing. If a deal was closed from an unexpected state or corrupted in the database, defaulting masks the bug and creates an invalid pipeline record.

**My Correction:**
I rejected the fallback and instructed the code to fail loudly:
```python
if not deal.previous_stage:
    raise InternalError(
        f"Corrupted state: closed deal #{deal.id} lacks previous_stage record",
        code=ErrorCodes.INVARIANT_VIOLATION
    )
if deal.previous_stage not in Stages.OPEN_ORDERED:
    raise InternalError(
        f"Corrupted state: previous_stage '{deal.previous_stage}' is not a valid open stage",
        code=ErrorCodes.INVARIANT_VIOLATION
    )
```
This turned a silent data bug into a clear, debuggable 500 error. I also added automated test cases in `scratch/test_deal_lifecycle.py` to verify that skipping stages, closing from `QUALIFIED`, backward moves without reasons, and reopening open deals are all rejected with specific error codes.

---

## 2. Multi-Role Authentication & Browser Session Isolation (Goal 1)

### The Pre-Story Plan & Context
To thoroughly test Role-Based Access Control (RBAC), I needed to have two browser windows open side-by-side: one logged in as a `SALES_MANAGER` (e.g. `manager@crm.local`) and one logged in as a `SALES_REP` (e.g. `alice@crm.local`), testing real-time permissions on the same company and deal records.

### Prompt
```text
Create the frontend authentication context AuthContext.jsx with login, logout, and token persistence for JWT authentication with Axios interceptors.
```

### What AI Generated
The AI scaffolded a clean React context that stored the JWT token in `localStorage`:
```javascript
localStorage.setItem('token', token);
localStorage.setItem('user', JSON.stringify(user));
```

### What was Wrong & What I Corrected
**Problem:** `localStorage` is shared across all tabs and windows in the same browser origin. Logging into the Sales Manager account in Tab A immediately overwrote Alice Rep's token in Tab B. When I clicked actions in Tab B expecting rep permissions, it was using the manager's token, producing confusing test results and masked permission bugs.

**My Correction:**
I refactored the auth context and `api/client.js` to use `sessionStorage` instead of `localStorage`. `sessionStorage` is strictly scoped to the individual browser tab, allowing simultaneous multi-role testing in split windows without session collisions.

---

## 3. Collaborators & Asymmetric Visibility Model (Goal 5 & Goal 1)

### The Pre-Story Plan & Context
The spec states: *"Sales reps can see only the companies and deals they own or collaborate on."*
This creates an interesting edge case: If Manager reassigns Deal X to Rep B, but the parent company is owned by Rep A:
- Rep B needs to see the parent company (to know who the customer is).
- But Rep B should **not** see other deals owned by Rep A in that same company.
- Conversely, Company Owner Rep A should be able to see all deals in their company.

### Prompt
```text
Write visibility helpers in backend/app/services/visibility_service.py to handle company deals when a rep is either the company owner or just a collaborator on one deal.
```

### What AI Generated
The AI provided a naive symmetric helper:
```python
def get_company_deals(user, company_id):
    company = Company.query.get(company_id)
    if can_view_company(user, company):
        return Deal.query.filter_by(company_id=company_id).all()
    return []
```

### What was Wrong & What I Corrected
**Security & Privacy Leak:** The AI assumed that if a rep can view the company, they should see *all* deals in it. This meant that adding Rep B as a collaborator on one small $5k deal leaked Rep A's other confidential $500k deals in the same company.

**My Correction:**
I rewrote `get_deals_in_company_query()` and `get_visible_deals_query()` with explicit asymmetric logic:
```python
# Company owner or manager sees all deals in the company
if user.role == Roles.SALES_MANAGER or company.owner_id == user.id:
    return query

# Non-owner rep ONLY sees deals they own or collaborate on
collaborating_deal_ids = db.session.query(DealCollaborator.deal_id).filter_by(user_id=user.id)
return query.filter(
    db.or_(
        Deal.owner_id == user.id,
        Deal.id.in_(collaborating_deal_ids)
    )
)
```
I also created a separate `get_my_deals_query()` specifically for the "My Deals" page (5) so that company-owned deals don't pollute a rep's personal daily workflow queue unless they are directly assigned or collaborating.

---

## 4. UI Testing Invariants vs Premature UI Disabling (Goal 4 & Goal 5 UI)

### The Pre-Story Plan & Context
The spec explicitly demands: *"The difference must be enforced on the server, not just hidden in the interface."*
I needed to verify that if someone maliciously or accidentally sends an invalid payload (e.g. skipping from `NEW` to `PROPOSAL` or editing a deal as a non-collaborator), the backend returns the exact expected HTTP 400/403/409/422 status code with a descriptive error message.

### Prompt
```text
Update the DealsPage.jsx and MyDealsPage.jsx components to add stage change dropdowns and action buttons for testing deal operations.
```

### What AI Generated
The AI tried to be "helpful" by disabling illegal stage options in the dropdown and hiding action buttons if the user wasn't the owner:
```jsx
<select disabled={!canEdit}>
  {availableStages.map(s => (
    <option key={s} disabled={!isValidNextStage(deal.stage, s)}>{s}</option>
  ))}
</select>
```

### What was Wrong & What I Corrected
**Problem:** By disabling the options in the frontend, the UI prevented me from actually testing the server-side validator and ensuring that toast error notifications trigger properly on invalid inputs.

**My Correction:**
I directed the AI to keep the dropdown options and buttons clickable during testing mode, ensuring that when an invalid move (e.g. `NEW` → `PROPOSAL` or backward without reason) is selected, the request hits the backend API, the backend rejects it with `INVALID_STAGE_TRANSITION` or `BACKWARD_REASON_REQUIRED`, and the frontend toast displays the exact backend error message to the user.

## 5. Preventing Unauthorized Deal Creation (Goal 9)

### The Pre-Story Plan & Context
i did the testing of all the rules rigourously but toady While i was testing the deal timeline, I started wondering what would happen if someone tried to bypass the frontend UI as frontend was showing a drop down list comming from backend while creating a deal. The frontend only shows reps the companies they are allowed to see in the "New Deal" dropdown. But what if a rep used a tool like Postman to send a request with the ID of a company they *aren't* allowed to see?

### Prompt
```text
now for testing i just want you to open the drop down to all companies ....like the companies bob cant see also i just want to test something
I want to test what happens if Bob tries to create a deal for a company he's not allowed to see i just wanted to test the backend only like if bob try to create a deal for a company he cant see what will happen that test dont cahneg the backend just the frontend part you can touch i have added backend for your context.
```

### What AI Generated / Discovered
The AI checked the `create_deal` function in the backend and realized we actually had a gap. The code checked if the company existed and wasn't archived, but it completely forgot to check if the user actually had permission to view that company! 

### What was Wrong & What I Corrected
**Problem:** The backend was blindly trusting that the user was only sending valid company IDs from the frontend dropdown. If someone bypassed the UI, they could attach a deal to a company they shouldn't even know about.

**My Correction:**
I told the AI we need to lock this down in the backend so it doesn't just rely on the frontend. We added a strict visibility check inside `create_deal`:
```python
if not visibility_service.can_view_company(current_user, company):
    raise AuthorizationError("You do not have permission to attach deals to this company.")
```
Now, if anyone tries to send a sneaky request for a hidden company, the server rejects it with a `403 Forbidden` error.
