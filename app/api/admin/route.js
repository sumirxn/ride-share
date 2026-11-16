import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { authorizeRequest } from "@/lib/api-auth";
import getMongoClient from "@/lib/mongodb";

export async function GET(request) {
  const authorization = await authorizeRequest(request, ["ADMIN"]);
  if (authorization.response) return authorization.response;

  try {
    const [users, offers, bookings, payments, rideRequests, ratings] = await Promise.all([
      pool.query(`
        SELECT user_id, name, email, phone, role, rating_avg, is_active, created_at
        FROM \`USER\`
        ORDER BY created_at DESC
      `),
      pool.query(`
        SELECT ro.ride_offer_id, ro.user_id, u.name AS driver_name,
               ro.departure_time, ro.available_seats, ro.cost_per_seat, ro.status,
               pickup.name AS pickup, dropoff.name AS drop_location
        FROM RIDE_OFFER ro
        JOIN \`USER\` u ON u.user_id = ro.user_id
        JOIN LOCATION pickup ON pickup.location_id = ro.pickup_location_id
        JOIN LOCATION dropoff ON dropoff.location_id = ro.drop_location_id
        ORDER BY ro.created_at DESC
      `),
      pool.query(`
        SELECT b.booking_id, b.status, b.seats_booked, b.booked_at, b.trip_id,
               passenger.name AS passenger_name, driver.name AS driver_name,
               pickup.name AS pickup, dropoff.name AS drop_location
        FROM BOOKING b
        JOIN \`MATCH\` m ON m.match_id = b.match_id
        JOIN RIDE_REQUEST rr ON rr.ride_request_id = m.ride_request_id
        JOIN RIDE_OFFER ro ON ro.ride_offer_id = m.ride_offer_id
        JOIN \`USER\` passenger ON passenger.user_id = rr.user_id
        JOIN \`USER\` driver ON driver.user_id = ro.user_id
        JOIN LOCATION pickup ON pickup.location_id = ro.pickup_location_id
        JOIN LOCATION dropoff ON dropoff.location_id = ro.drop_location_id
        ORDER BY b.booked_at DESC
      `),
      pool.query(`
        SELECT p.payment_id, p.booking_id, p.paid_by, u.name AS payer_name,
               p.amount, p.payment_status, p.paid_at
        FROM PAYMENT p
        JOIN \`USER\` u ON u.user_id = p.paid_by
        ORDER BY p.payment_id DESC
      `),
      pool.query(`
        SELECT rr.ride_request_id, rr.user_id, u.name AS passenger_name,
               rr.requested_time, rr.seats_required, rr.max_detour_minutes,
               rr.status, pickup.name AS pickup, dropoff.name AS drop_location
        FROM RIDE_REQUEST rr
        JOIN \`USER\` u ON u.user_id = rr.user_id
        JOIN LOCATION pickup ON pickup.location_id = rr.pickup_location_id
        JOIN LOCATION dropoff ON dropoff.location_id = rr.drop_location_id
        ORDER BY rr.created_at DESC
      `),
      pool.query(`
        SELECT r.rating_id, r.trip_id, r.rated_by, r.rated_to,
               author.name AS author_name, recipient.name AS recipient_name,
               r.rating_value, r.review, r.rated_at
        FROM RATING r
        JOIN \`USER\` author ON author.user_id = r.rated_by
        JOIN \`USER\` recipient ON recipient.user_id = r.rated_to
        ORDER BY r.rated_at DESC
      `),
    ]);

    let activity = { count: 0, recent: [] };
    let popularRoutes = [];
    let analyticsError = null;
    try {
      const client = await getMongoClient();
      const activityCollection = client
        .db("carpooling_system")
        .collection("ride_activity");
      const [activityCount, recentActivity, routes] = await Promise.all([
        activityCollection.countDocuments(),
        activityCollection
          .find(
            {},
            {
              projection: {
                _id: 0,
                userId: 1,
                activityType: 1,
                pickup: 1,
                drop: 1,
                createdAt: 1,
              },
            }
          )
          .sort({ createdAt: -1 })
          .limit(50)
          .toArray(),
        activityCollection
          .aggregate([
            { $match: { activityType: "RIDE_SEARCH" } },
            {
              $group: {
                _id: { pickup: "$pickup", drop: "$drop" },
                searchCount: { $sum: 1 },
              },
            },
            { $sort: { searchCount: -1 } },
          ])
          .toArray(),
      ]);
      activity = { count: activityCount, recent: recentActivity };
      popularRoutes = routes;
    } catch (error) {
      analyticsError = "MongoDB analytics are temporarily unavailable";
      console.error("Failed to load MongoDB admin analytics:", error);
    }

    return NextResponse.json({
      users: users[0],
      offers: offers[0],
      bookings: bookings[0],
      payments: payments[0],
      rideRequests: rideRequests[0],
      ratings: ratings[0],
      activity,
      popularRoutes,
      analyticsError,
    });
  } catch (error) {
    console.error("Failed to load admin dashboard:", error);
    return NextResponse.json(
      { message: "Failed to load administrative data" },
      { status: 500 }
    );
  }
}
