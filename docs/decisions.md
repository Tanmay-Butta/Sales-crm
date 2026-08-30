# Decisions

Log the decisions that actually shaped this codebase â€” the ones where a real alternative existed and
you picked one. At least five entries. For each: what you chose, what you rejected, and why. At least
one entry must be a decision you later reversed â€” say what changed your mind. It can be any entry
below, not necessarily the last one; add a **Later reversed:** line to whichever one it is.

## Decision 1

- **Chose:**
- **Rejected:**
- **Why:**

## Decision 2

- **Chose:**
- **Rejected:**
- **Why:**

## Decision 3

- **Chose:**
- **Rejected:**
- **Why:**

## Decision 4

- **Chose:**
- **Rejected:**
- **Why:**

## Decision 5

- **Chose:**
- **Rejected:**
- **Why:**

### Assumptions & Business Rules
- **Company Archival**: Archiving a company is a soft-delete to preserve history. Existing deals belonging to an archived company remain intact and accessible according to normal deal visibility rules. However, creating a *new* deal under an archived company is rejected server-side to prevent accumulating new pipeline on dead accounts.

- **Session Storage over Local Storage**: Initially,i used localStorage to store the JWT access token. However, because this application heavily relies on strict Role-Based Access Control (RBAC), reviewers and developers need to test multiple roles (Sales Manager vs Sales Reps) simultaneously. localStorage is shared across all tabs, meaning logging in as a Rep in one tab would silently overwrite the Manager's token in another tab, causing confusing cross-tab authorization errors during testing. I switched to sessionStorage so that each browser tab maintains a completely isolated session, allowing side-by-side role testing, as well as providing a better real-world user experience for employees who may need to manage multiple accounts simultaneously without cross-tab session collisions.
-**assumption for companies**:
Company owner must be a Sales Rep, never a Manager
- **Implicit Company Visibility**: The requirement states Sales reps... can see only the companies and deals they own or collaborate on. I interpret this to mean that owning a Deal (or collaborating on a Deal) implicitly grants the Rep **read-only visibility** to the parent Company. If a Manager reassigns a deal to Rep XYZ, Rep XYZ will be able to see the parent company in their Companies list (so they know who they are selling to), but they will not be able to edit or archive the company unless they are the direct owner of the company itself.
