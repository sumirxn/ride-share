import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { authorizeRequest } from "@/lib/api-auth";

class BookingError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export async function POST(request) {
  const authorization = await authorizeRequest(request, ["PASSENGER"]);
  if (authorization.response) return authorization.response;

  let connection;
  let rideRequestId;
  let matchId;
  let requestAndMatchCommitted = false;
  let transactionOpen = false;
  let bookingProcedureCompleted = false;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      throw new BookingError("Request body must be valid JSON", 400);
    }

    const rideOfferId = Number(body?.rideOfferId);
    const seatsBooked = Number(body?.seatsBooked);

    if (
      !isPositiveInteger(rideOfferId) ||
      !isPositiveInteger(seatsBooked)
    ) {
      throw new BookingError(
        "Ride and seat count must be valid positive integers",
        400
      );
    }

    connection = await pool.getConnection();
    const passengerId = authorization.user.user_id;

    await connection.beginTransaction();
    transactionOpen = true;

    const [offers] = await connection.execute(
      `SELECT ride_offer_id, user_id, pickup_location_id, drop_location_id,
              departure_time, available_seats, status
       FROM RIDE_OFFER
       WHERE ride_offer_id = ?
       FOR UPDATE`,
      [rideOfferId]
    );

    const offer = offers[0];
    if (!offer || offer.status !== "OPEN") {
      throw new BookingError("This ride is no longer open for booking", 409);
    }
    if (Number(offer.user_id) === Number(passengerId)) {
      throw new BookingError("You cannot book your own ride", 403);
    }

    if (seatsBooked > offer.available_seats) {
      throw new BookingError("Not enough seats are available", 409);
    }

    const [trips] = await connection.execute(
      `SELECT trip_id, status
       FROM TRIP
       WHERE ride_offer_id = ?`,
      [rideOfferId]
    );

    const trip = trips[0];
    if (!trip) {
      throw new BookingError(
        "This ride has no associated trip and cannot be booked",
        409
      );
    }

    if (trip.status !== "SCHEDULED") {
      throw new BookingError("This trip is no longer scheduled", 409);
    }

    const [requestResult] = await connection.execute(
      `INSERT INTO RIDE_REQUEST
        (user_id, pickup_location_id, drop_location_id, requested_time,
         seats_required, max_detour_minutes, status)
       VALUES (?, ?, ?, ?, ?, 0, 'MATCHED')`,
      [
        passengerId,
        offer.pickup_location_id,
        offer.drop_location_id,
        offer.departure_time,
        seatsBooked,
      ]
    );
    rideRequestId = requestResult.insertId;

    const [matchResult] = await connection.execute(
      `INSERT INTO \`MATCH\` (ride_offer_id, ride_request_id, match_score)
       VALUES (?, ?, 100.00)`,
      [rideOfferId, rideRequestId]
    );
    matchId = matchResult.insertId;

    await connection.commit();
    transactionOpen = false;
    requestAndMatchCommitted = true;

    await connection.query("CALL create_booking(?, ?, ?)", [
      matchId,
      trip.trip_id,
      seatsBooked,
    ]);
    bookingProcedureCompleted = true;

    const [bookings] = await connection.execute(
      "SELECT booking_id FROM BOOKING WHERE match_id = ? AND trip_id = ?",
      [matchId, trip.trip_id]
    );

    if (bookings.length === 0) {
      throw new Error("Booking procedure did not return a saved booking");
    }

    return NextResponse.json(
      {
        bookingId: bookings[0].booking_id,
        rideRequestId,
        matchId,
        tripId: trip.trip_id,
        message: "Ride booked successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    if (connection && !bookingProcedureCompleted) {
      try {
        if (!requestAndMatchCommitted) {
          if (transactionOpen) {
            await connection.rollback();
            transactionOpen = false;
          }
        } else if (rideRequestId && matchId) {
          await connection.beginTransaction();
          transactionOpen = true;
          await connection.execute(
            "DELETE FROM `MATCH` WHERE match_id = ?",
            [matchId]
          );
          await connection.execute(
            "DELETE FROM RIDE_REQUEST WHERE ride_request_id = ?",
            [rideRequestId]
          );
          await connection.commit();
          transactionOpen = false;
        }
      } catch (cleanupError) {
        console.error("Failed to clean up an unsuccessful booking:", cleanupError);
        if (transactionOpen) {
          try {
            await connection.rollback();
            transactionOpen = false;
          } catch (rollbackError) {
            console.error("Failed to roll back booking cleanup:", rollbackError);
          }
        }
        return NextResponse.json(
          {
            message:
              "Booking failed and its request could not be cleaned up. Please contact support.",
          },
          { status: 500 }
        );
      }
    }

    if (error instanceof BookingError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (error?.sqlState === "45000") {
      return NextResponse.json(
        { message: error.sqlMessage || "The database rejected this booking" },
        { status: 409 }
      );
    }

    console.error("Failed to create booking:", error);
    return NextResponse.json(
      { message: "Failed to create booking. Please try again." },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}

export async function GET(request) {
  const authorization = await authorizeRequest(request, ["PASSENGER", "DRIVER"]);
  if (authorization.response) return authorization.response;

  try {
    const ownerFilter =
      authorization.user.role === "DRIVER" ? "ro.user_id = ?" : "rr.user_id = ?";
    const [bookings] = await pool.execute(
      `SELECT DISTINCT
         b.booking_id, b.status, b.seats_booked, b.booked_at, b.trip_id,
         rr.ride_request_id, rr.user_id AS passenger_id,
         ro.ride_offer_id, ro.user_id AS driver_id,
         t.start_time, t.end_time, t.status AS trip_status,
         EXISTS (
           SELECT 1 FROM PAYMENT p
           WHERE p.booking_id = b.booking_id AND p.payment_status = 'PAID'
         ) AS has_paid,
         pickup.name AS pickup, dropoff.name AS drop_location,
         driver.name AS driver_name, passenger.name AS passenger_name
       FROM BOOKING b
       JOIN \`MATCH\` m ON m.match_id = b.match_id
       JOIN RIDE_REQUEST rr ON rr.ride_request_id = m.ride_request_id
       JOIN RIDE_OFFER ro ON ro.ride_offer_id = m.ride_offer_id
       JOIN \`USER\` driver ON driver.user_id = ro.user_id
       JOIN \`USER\` passenger ON passenger.user_id = rr.user_id
       JOIN TRIP t ON t.trip_id = b.trip_id
       JOIN LOCATION pickup ON pickup.location_id = ro.pickup_location_id
       JOIN LOCATION dropoff ON dropoff.location_id = ro.drop_location_id
       WHERE ${ownerFilter}
       ORDER BY b.booked_at DESC`,
      [authorization.user.user_id]
    );
    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Failed to load user bookings:", error);
    return NextResponse.json(
      { message: "Failed to load bookings" },
      { status: 500 }
    );
  }
}
