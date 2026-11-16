# Carpooling & Ride Matching System

A full-stack carpooling application that allows users to search for available rides based on pickup and drop locations. Uses MySQL for relational data and MongoDB for storing ride search activity and identifying popular routes.

## Tech Stack
- **Frontend:** Next.js, React.js, CSS
- **Backend:** Node.js, Next.js API Routes
- **Databases:** MySQL, MongoDB
- **Database Concepts:** Triggers, Stored Procedures, Transactions

## Features
- Search available rides by pickup and drop locations.
- Manage ride offers, requests, matches, and bookings.
- Prevent overbooking using transaction-based stored procedures.
- Automatically maintain user ratings using SQL triggers.
- Track ride searches and identify popular routes using MongoDB.

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

3. Configure MySQL and MongoDB credentials in `.env.local`.

4. Install dependencies and run:
   ```bash
   npm install
   npm run dev
   ```

5. Open `http://localhost:3000`.
