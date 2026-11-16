# Carpooling & Ride Matching System

A full-stack carpooling application that allows users to search for available rides based on pickup and drop locations. Uses MySQL for relational data and MongoDB for storing ride search activity and identifying popular routes.

## Tech Stack
- **Frontend:** Next.js, React.js, CSS
- **Backend:** Node.js, Next.js API Routes
- **Databases:** MySQL, MongoDB
- **Database Concepts:** Triggers, Stored Procedures, Transactions

## Features
- Register and sign in with bcrypt-hashed passwords and signed, HTTP-only sessions.
- Enforce `PASSENGER`, `DRIVER` and `ADMIN` permissions in Next.js API routes.
- Search available rides by pickup and drop locations.
- Create ride offers and ride requests, and view your own booking information.
- Prevent overbooking using transaction-based stored procedures.
- Automatically maintain user ratings using SQL triggers.
- Track ride searches and identify popular routes using MongoDB.
- Provide separate passenger, driver and administrator dashboards.

## Database Design

**MySQL:** 11 relational tables covering users, vehicles, ride offers, ride requests, matches, trips, bookings, payments, cancellations, and ratings.

**MongoDB:** Stores ride search activity and supports popular route aggregation.

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/sumirxn/ride-share.git
   cd ride-share
   ```

2. Set up the MySQL database:
   ```bash
   mysql -u root -p < database/schema.sql
   mysql -u root -p < database/triggers_procedures.sql
   mysql -u root -p < database/test_data.sql
   ```
   For an existing installation, back up the database and apply
   `database/migrate_role_types.sql` once. It maps legacy `USER` accounts with
   owned vehicles or ride offers to `DRIVER` and other legacy `USER` accounts
   to `PASSENGER`, while retaining existing `ADMIN` accounts. The migration
   keeps foreign keys and relationships intact.

3. Configure MySQL and MongoDB credentials in `.env.local`. Add:
   ```env
   SESSION_SECRET=<at-least-32-random-characters>
   ADMIN_BOOTSTRAP_TOKEN=<a-separate-random-secret>
   ```
   Generate both values locally, for example with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
   `.env.local` is ignored by Git and must never be committed.

4. Install dependencies and run:
   ```bash
   npm install
   npm run dev
   ```

5. Open `http://localhost:3000`.

## Accounts and administrator setup

- Register at `/register` as a `PASSENGER` or `DRIVER`. Public registration
  rejects `ADMIN`; an administrator can change another user's role.
- Sign in at `/login`; logout is available from the dashboard.
- After registering the account intended to administer a fresh database, sign in
  and open `/setup-admin`. Enter `ADMIN_BOOTSTRAP_TOKEN`. This one-time operation
  is allowed only while there is no administrator with a bcrypt password hash.
- Existing seed rows in `database/test_data.sql` use placeholder values such as
  `hash_arun` and `hash_admin`; they are not usable login passwords. Existing
  accounts need a real bcrypt password hash set by a trusted database operator,
  or use a newly registered account for the one-time setup.
- Administrators can view users, offers, bookings and payments at `/admin`,
  requests, ratings, activity and popular routes; update another user's role;
  and deactivate/reactivate accounts. The last active administrator and the
  signed-in administrator cannot be disabled or demoted through the dashboard.
- Drivers use `/driver` to register/update vehicles, create/cancel their own
  offers, view their trips and booked passengers, and rate passengers after
  completed trips. Passengers use `/` to search/request/book rides, pay and rate
  drivers, view history and cancel eligible unpaid bookings.

The application reuses the existing MySQL `USER` table and foreign-key
relationships. Fresh installations use the updated schema; existing databases
must run `database/migrate_role_types.sql` once. Ride booking continues through
the existing `create_booking` procedure.
Payment creation continues to use its existing transaction. MongoDB remains
responsible for ride activity and popular-route analytics.
