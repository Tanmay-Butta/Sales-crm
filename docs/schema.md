# Schema

## Table by table: what columns and types does each one have?

I kept the schema fairly simple and tried to make the database responsible for basic data integrity, while keeping the more complicated workflow rules in the service layer.

### `users`

This table stores the users who can log in and their roles.

* `id` (`Integer`, PK): Unique user ID.
* `email` (`String(255)`, Unique, Not Null, Indexed): Email used for login.
* `password_hash` (`String(255)`, Not Null): Hashed password. I never store the actual password.
* `full_name` (`String(255)`, Not Null): Name shown in the application.
* `role` (`String(20)`, Not Null): Either `SALES_MANAGER` or `SALES_REP`.
* `created_at` (`DateTime`, Not Null): When the account was created.
* `updated_at` (`DateTime`, Not Null): Last time the account was updated.

### `companies`

This represents the companies that the sales team is working with.

* `id` (`Integer`, PK): Unique company ID.
* `name` (`String(255)`, Not Null): Company name.
* `industry` (`String(255)`, Not Null): Industry of the company.
* `website` (`String(500)`, Nullable): Company website, if provided.
* `owner_id` (`Integer`, FK → `users.id`, Not Null, Indexed): Sales rep who owns the company.
* `archived_at` (`DateTime`, Nullable, Indexed): Used for soft archiving. `NULL` means active.
* `created_at` (`DateTime`, Not Null): Creation time.
* `updated_at` (`DateTime`, Not Null): Last modification time.

I used soft archiving because the README says that archiving a company should not destroy its deals. So the company can disappear from normal views without losing its data.

### `deals`

This table stores the actual sales opportunities.

* `id` (`Integer`, PK): Unique deal ID.
* `title` (`String(255)`, Not Null): Short name/title of the deal.
* `value` (`Numeric(15,2)`, Not Null): Deal value. I used a fixed decimal type because this is money and I don't want floating-point rounding issues.
* `expected_close_date` (`Date`, Not Null): Expected date for closing the deal.
* `stage` (`String(20)`, Not Null, Default `NEW`): Current stage of the deal.
* `previous_stage` (`String(20)`, Nullable): Stores the stage immediately before a deal was closed. This is used when a manager reopens a closed deal.
* `closed_at` (`DateTime`, Nullable): Set when the deal reaches `WON` or `LOST`.
* `company_id` (`Integer`, FK → `companies.id`, Not Null, Indexed): Company this deal belongs to.
* `owner_id` (`Integer`, FK → `users.id`, Not Null, Indexed): Sales rep responsible for the deal.
* `alert_dismissed_for_date` (`Date`, Nullable): Tracks dismissal of a past-due alert for a particular date.
* `deleted_at` (`DateTime`, Nullable): Used for soft deletion of deals. `NULL` means the deal is active.
* `created_at` (`DateTime`, Not Null): Creation time.
* `updated_at` (`DateTime`, Not Null): Last modification time.

One important decision here was making `company_id` and `owner_id` required. A deal without a company or an owner would not make sense in this system.

### `deal_collaborators`

I used a separate join table because a deal can have more than one collaborating rep.

* `id` (`Integer`, PK): Unique row ID.
* `deal_id` (`Integer`, FK → `deals.id`, Not Null, Indexed): Deal being collaborated on.
* `user_id` (`Integer`, FK → `users.id`, Not Null, Indexed): Rep who is collaborating.
* `added_by` (`Integer`, FK → `users.id`, Not Null): User who added the collaborator.
* `created_at` (`DateTime`, Not Null): When the collaboration was added.

I also added a unique constraint on `(deal_id, user_id)` so the same rep cannot accidentally be added to the same deal twice.

### `deal_history`

This is the immutable timeline for a deal.

* `id` (`Integer`, PK): Unique history entry.
* `deal_id` (`Integer`, FK → `deals.id`, Not Null, Indexed): Deal this event belongs to.
* `event_type` (`String(50)`, Not Null): Type of event, such as `STAGE_CHANGED`, `OWNER_CHANGED`, or `NOTE_ADDED`.
* `old_value` (`JSON`, Nullable): Previous state when the event needs it.
* `new_value` (`JSON`, Nullable): New state after the event.
* `reason` (`Text`, Nullable): Reason for a backward stage movement.
* `actor_id` (`Integer`, FK → `users.id`, Not Null): User who performed the action.
* `created_at` (`DateTime`, Not Null, Indexed): When the event happened.

There is intentionally no `updated_at` here. Once a history entry is created, it should not be changed.

---

## Which relationships are one-to-many, and which are many-to-many?

I tried to model the relationships based on how the application actually works rather than forcing everything into one table.

### One-to-many

**User → Company**

One sales rep can own many companies, but each company has one owner.

```text
Rahul
 ├── Google
 ├── Microsoft
 └── Amazon
```

**User → Deal**

One sales rep can own many deals, but each deal has one primary owner.

**Company → Deal**

One company can have many deals, but each deal belongs to exactly one company.

```text
Google
 ├── Cloud Contract
 ├── Enterprise License
 └── Support Deal
```

**Deal → DealHistory**

One deal can have many history events.

```text
Deal
 ├── Created
 ├── Stage changed
 ├── Owner changed
 └── Note added
```

**User → DealHistory**

One user can perform many actions, so one user can appear as the actor in many history records.

### Many-to-many

**Deal ↔ User through `deal_collaborators`**

A deal can have multiple collaborators, and a rep can collaborate on multiple deals.

For example:

```text
Deal A → Rahul, Charlie
Deal B → Charlie, Aman
```

Charlie is therefore collaborating on multiple deals, which is why a simple `user_id` column inside `deals` would not be enough.

---

## Which constraints are enforced by the database, and which by application code?

I tried to keep a clear separation here.

### Database handles basic data integrity

I use the database for rules that should always be true regardless of where the request comes from.

For example:

* User emails are unique.
* Foreign keys must point to real records.
* `company_id` and `owner_id` cannot be null.
* Deal value cannot be negative.
* User roles must be one of the supported roles.
* Deal stages must be valid stage names.
* History event types must be valid.
* The same collaborator cannot be added twice to the same deal.

These are good database constraints because they protect the data even if there is a bug in the frontend or service layer.

### Application code handles workflow rules

The service layer handles rules that depend on the current user, previous state, or the action being performed.

For example:

* A rep can only access deals they own or collaborate on.
* A manager can access all deals.
* Only the owner or manager can manage certain things.
* Only managers can reassign a deal.
* Collaborators must be sales reps.
* A deal cannot skip stages.
* A backward stage move requires a reason.
* A closed deal cannot normally change stage.
* Only a manager can reopen a closed deal.
* A company cannot be created for an invalid owner.
* Archived companies cannot be used for new deals.

I kept these out of database constraints because they are much easier to express and maintain in application code.

For example, checking `New -> Proposal` is not just a simple data type check. The service needs to know the current stage, the requested stage, who is making the request, and possibly the reason.

I found it much easier to keep this logic in one place instead of spreading it across database constraints and routes.

---

## What did I deliberately denormalise?

There are a few places where I intentionally stored information that could technically be calculated or reconstructed somewhere else.

### `deals.previous_stage`

When a deal moves from `NEGOTIATION` to `WON` or `LOST`, I store the previous stage directly on the deal.

Without this, reopening a deal would require looking through its history to find the correct stage.

With it, reopening is simple:

```text
Negotiation → Won

previous_stage = Negotiation

Manager reopens

Won → Negotiation
```

This also makes the intended restore point explicit.

### JSON snapshots in `deal_history`

I store `old_value` and `new_value` as JSON.

For example:

```json
{
  "owner_id": 2,
  "owner_name": "Alice Rep"
}
```

The reason I did this is that the history should describe what actually happened at that time. If Alice changes her name later, the old history should still show the information that was recorded when the event happened.

### Win probability is NOT stored

I deliberately did not store win probability inside `deals`.

Instead, it is calculated from the current stage using the stage probability configuration.

For example:

```text
NEW          → 10%
QUALIFIED    → 25%
PROPOSAL     → 50%
NEGOTIATION  → 75%
```

This avoids having a deal's stored probability become inconsistent with its stage.

---

## What would break first if this had 100x the data?

The first thing I would expect to have problems is **queries that return too much data**, especially deal listings.

Right now, an unpaginated query using `.all()` is fine for a small assignment dataset. With hundreds of thousands of deals, it would become expensive because the server would try to load a huge result set into memory.

So server-side pagination and filtering become very important.

### Visibility queries

The visibility logic also becomes more expensive as the number of deals and collaborators grows.

For example, checking:

```text
Deals I own
OR
Deals I collaborate on
OR
Deals under companies I can access
```

across hundreds of thousands of rows will need proper indexes.

I would look at composite indexes such as:

```text
(owner_id, deleted_at)
(company_id, deleted_at)
```

and indexes on the collaborator relationships.

### Deal history

The history table will probably grow faster than the main deal table because one deal can generate many history records.

For example, one deal might have:

```text
Created
Stage changed
Stage changed
Backward movement
Owner changed
Collaborator added
Note added
```

As the system grows, `deal_history` could become much larger than `deals`. At a much bigger scale, I would consider partitioning the history table by time or deal ID.

### What I would improve first

If this actually reached 100x the current data, my first improvements would be:

1. Make all deal listing endpoints paginated.
2. Add and verify indexes based on actual query patterns.
3. Profile the visibility queries instead of assuming they are fast enough.
4. Consider partitioning `deal_history` if it becomes very large.

I don't think the schema needs to be completely redesigned at 100x. The first problems would mostly come from query size, visibility checks, and the growing history table.
