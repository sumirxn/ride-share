import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { authorizeRequest } from "@/lib/api-auth";

class CancellationError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function POST(request, context) {
  const authorization = await authorizeRequest(request, ["PASSENGER"]);
  if (authorization.response) return authorization.response;

  const bookingId = Number((await context.params).bookingId);
  if (!Number.isSafeInteger(bookingId) || bookingId < 1) {
    return NextResponse.json({ message: "Invalid booking ID" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Request body must be valid JSON" },
      { status: 400 }
    );
  }
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (reason.length > 255) {
    return NextResponse.json(
      { message: "Cancellation reason must be 255 characters or fewer" },
      { status: 400 }
    );
  }

  let connection;
  let transactionOpen = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionOpen = true;
    const [rows] = await connection.execute(
      `SELECT b.booking_id, b.status AS booking_status, b.seats_booked,
              rr.ride_request_id, ro.ride_offer_id, ro.available_seats,
              v.seating_capacity, t.trip_id, t.status AS trip_status,
              ro.departure_time
       FROM BOOKING b
       JOIN \`MATCH\` m ON m.match_id = b.match_id
       JOIN RIDE_REQUEST rr ON rr.ride_request_id = m.ride_request_id
       JOIN RIDE_OFFER ro ON ro.ride_offer_id = m.ride_offer_id
       JOIN VEHICLE v ON v.vehicle_id = ro.vehicle_id
       JOIN TRIP t ON t.trip_id = b.trip_id AND t.ride_offer_id = ro.ride_offer_id
       WHERE b.booking_id = ? AND rr.user_id = ?
       FOR UPDATE`,
      [bookingId, authorization.user.user_id]
    );
    const booking = rows[0];
    if (!booking) {
      throw new CancellationError("Booking not found", 404);
    }
    if (
      booking.booking_status !== "CONFIRMED" ||
      booking.trip_status !== "SCHEDULED" ||
      new Date(booking.departure_time).getTime() <= Date.now()
    ) {
      throw new CancellationError(
        "Only confirmed bookings on scheduled trips can be cancelled",
        409
      );
    }
    if (
      Number(booking.available_seats) + Number(booking.seats_booked) >
      Number(booking.seating_capacity)
    ) {
      throw new CancellationError(
        "The ride no longer has capacity to restore these seats",
        409
      );
    }

    const [payments] = await connection.execute(
      `SELECT payment_id
       FROM PAYMENT
       WHERE booking_id = ? AND payment_status = 'PAID'
       LIMIT 1
       FOR UPDATE`,
      [bookingId]
    );
    if (payments.length) {
      throw new CancellationError(
        "Paid bookings cannot be cancelled through this flow",
        409
      );
    }

    await connection.execute(
      "UPDATE BOOKING SET status = 'CANCELLED' WHERE booking_id = ?",
      [bookingId]
    );
    await connection.execute(
      "UPDATE RIDE_REQUEST SET status = 'CANCELLED' WHERE ride_request_id = ?",
      [booking.ride_request_id]
    );
    await connection.execute(
      `UPDATE RIDE_OFFER
       SET available_seats = available_seats + ?,
           status = CASE WHEN status = 'FULL' THEN 'OPEN' ELSE status END
       WHERE ride_offer_id = ?`,
      [booking.seats_booked, booking.ride_offer_id]
    );
    await connection.execute(
      `INSERT INTO CANCELLATION (booking_id, cancelled_by, reason, penalty_amount)
       VALUES (?, ?, ?, 0.00)`,
      [bookingId, authorization.user.user_id, reason || null]
    );
    await connection.commit();
    transactionOpen = false;
    return NextResponse.json({ message: "Booking cancelled successfully" });
  } catch (error) {
    if (transactionOpen) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Failed to roll back booking cancellation:", rollbackError);
      }
    }
    if (error instanceof CancellationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("Failed to cancel booking:", error);
    return NextResponse.json(
      { message: "Failed to cancel booking" },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
