# Architecture

# Architecture

## What are the moving pieces, and how do they talk to each other?

The system has three main parts:

* **Frontend:** React + Vite. Handles the UI and sends API requests through Axios.
* **Backend:** Flask REST API. Handles authentication, validation, permissions and business rules.
* **Database:** PostgreSQL. Stores users, companies, deals, collaborators and history.

The basic flow is:

`React → Flask API → SQLAlchemy → PostgreSQL`

I kept the backend separated into routes, schemas, services and models. This became useful once the business rules started getting more complicated. For example, I didn't want every route to implement its own version of deal visibility or stage validation.

The frontend can hide actions the user should not normally perform, but the backend always checks the permission again. This was important because a user can bypass the UI and call the API directly.

## Where does each piece run?

The frontend runs in the browser and can be deployed as static files on Vercel.

The Flask backend runs as a server process and can be deployed behind Gunicorn.

PostgreSQL runs locally during development and can use a managed PostgreSQL service in production.

I kept the infrastructure simple because the expected team is small and the main complexity is in the business rules.

## What is the request path for one representative user action?

For example, when a rep moves a deal from `NEW` to `QUALIFIED`:

`UI → Axios → Flask → Auth → Validation → Permission check → Lifecycle check → Database → Response → UI`

The backend first verifies who the user is, then checks whether they can edit the deal and whether the stage transition is valid.

For example:

`NEW → QUALIFIED` ✓

`NEW → PROPOSAL` ✗

If the change succeeds, the deal and its history entry are saved together.

## What did I decide not to build, and why?

* **No public Sign Up page:** This is an internal CRM, so I assumed accounts would normally be created internally. I still added the `/api/auth/register` endpoint for internal/programmatic user creation.
* **No email verification/password reset:** Useful for production, but outside the main assignment scope.
* **No real-time updates:** Users may need to refresh to see another user's changes. This is acceptable for the small team described in the scenario.
* **No microservices:** One Flask application is enough for this scale. I didn't want to add infrastructure without a real need.

As I built the project, I also changed some of my initial design decisions. For example, I moved visibility and lifecycle rules into shared services once I saw that multiple features needed the same logic. This made the code easier to maintain and reduced the chance of different parts of the application behaving differently.
