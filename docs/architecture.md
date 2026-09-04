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

* **Frontend:** The client runs in the browser as a Single-Page Application (SPA) built with React and Vite, hosted on Vercel. Requests to the API are directed via the environment-configured `VITE_API_URL`.
* **Backend:** The Flask REST API is containerized with a production Dockerfile and deployed as a serverless container on **Google Cloud Run** in region `asia-south1`. Images are built automatically via **Google Cloud Build** and stored in Google Artifact Registry. In production, requests are handled by Gunicorn workers dynamically bound to Cloud Run's `$PORT`.
* **Database:** Production data lives on a managed **Supabase PostgreSQL** instance, connected over secure SSL. Database schemas, indexes, and constraints are maintained through versioned Alembic migrations (`flask db upgrade`).

I chose this serverless and managed stack because it provides high availability, automatic HTTPS, scale-to-zero efficiency (staying within free tiers), and zero database server maintenance, allowing the focus to remain on enforcing business rules.

## What is the request path for one representative user action?

For example, when a rep moves a deal from `NEW` to `QUALIFIED`:

`UI → Axios → Flask → Auth → Validation → Permission check → Lifecycle check → Database → Response → UI`

The backend first verifies who the user is, then checks whether they can edit the deal and whether the stage transition is valid.

For example:

`NEW → QUALIFIED` ✓

`NEW → PROPOSAL` ✗

If the change succeeds, the deal and its history entry are saved together.

## What did I decide not to build, and why?

* **No public Sign Up page or public registration endpoint:** This is an internal CRM, so user accounts cannot be self-registered on the open internet. User provisioning is strictly manager-gated via `POST /api/auth/users`, where `SALES_REP` is enforced by the server and client-supplied role parameters are forbidden. The initial manager is provisioned via seed/CLI.
* **No email verification/password reset:** Useful for production, but outside the main assignment scope.
* **No real-time updates:** Users may need to refresh to see another user's changes. This is acceptable for the small team described in the scenario.
* **No microservices:** One Flask application is enough for this scale. I didn't want to add infrastructure without a real need.

As I built the project, I also changed some of my initial design decisions. For example, I moved visibility and lifecycle rules into shared services once I saw that multiple features needed the same logic. This made the code easier to maintain and reduced the chance of different parts of the application behaving differently.
