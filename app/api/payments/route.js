import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { authorizeRequest } from "@/lib/api-auth";

class PaymentError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

const paymentBookingSelect = `
  SELECT
    b.booking_id,
    b.status AS booking_status,
    b.seats_booked,
    b.trip_id,
    rr.user_id AS passenger_id,
    passenger.name AS passenger_name,
    passenger.is_active AS passenger_is_active,
    pickup.name AS pickup,
    dropoff.name AS drop_location,
    ro.cost_per_seat,
    CAST(ro.cost_per_seat * b.seats_booked AS DECIMAL(21, 2)) AS amount,
    t.status AS trip_status
  FROM BOOKING b
  JOIN \`MATCH\` m ON m.match_id = b.match_id
  JOIN RIDE_REQUEST rr ON rr.ride_request_id = m.ride_request_id
  JOIN \`USER\` passenger ON passenger.user_id = rr.user_id
  JOIN TRIP t
    ON t.trip_id = b.trip_id AND t.ride_offer_id = m.ride_offer_id
  JOIN RIDE_OFFER ro ON ro.ride_offer_id = m.ride_offer_id
  JOIN LOCATION pickup ON pickup.location_id = ro.pickup_location_id
  JOIN LOCATION dropoff ON dropoff.location_id = ro.drop_location_id
`;

const paymentStatusesThatBlockAnotherPayment = ["PENDING", "PAID"];

export async function GET(request) {
  const authorization = await authorizeRequest(request, ["PASSENGER"]);
  if (authorization.response) return authorization.response;

  try {
    const [bookings] = await pool.execute(`
      ${paymentBookingSelect}
      WHERE b.status IN ('CONFIRMED', 'COMPLETED')
        AND t.status <> 'CANCELLED'
        AND passenger.is_active = TRUE
        AND rr.user_id = ?
        AND NOT EXISTS (
          SELECT 1
          FROM PAYMENT existing_payment
          WHERE existing_payment.booking_id = b.booking_id
            AND existing_payment.payment_status IN ('PENDING', 'PAID')
        )
      ORDER BY b.booked_at DESC
    `, [authorization.user.user_id]);

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Failed to load eligible payment bookings:", error);
    return NextResponse.json(
      { message: "Failed to load eligible bookings" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const authorization = await authorizeRequest(request, ["PASSENGER"]);
  if (authorization.response) return authorization.response;

  let connection;
  let transactionOpen = false;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      throw new PaymentError("Request body must be valid JSON", 400);
    }

    const bookingId = Number(body?.bookingId);
    if (!isPositiveInteger(bookingId)) {
      throw new PaymentError("Select a valid booking", 400);
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionOpen = true;

    const [bookings] = await connection.execute(
      `${paymentBookingSelect}
       WHERE b.booking_id = ?
       FOR UPDATE`,
      [bookingId]
    );

    const booking = bookings[0];
    if (!booking) {
      throw new PaymentError("Booking was not found", 404);
    }
    if (Number(booking.passenger_id) !== Number(authorization.user.user_id)) {
      throw new PaymentError("You cannot pay for another user's booking", 403);
    }

    if (!["CONFIRMED", "COMPLETED"].includes(booking.booking_status)) {
      throw new PaymentError(
        "Only confirmed or completed bookings can be paid",
        409
      );
    }

    if (!booking.passenger_is_active) {
      throw new PaymentError("The booking passenger is not active", 409);
    }

    if (booking.trip_status === "CANCELLED") {
      throw new PaymentError("A cancelled trip cannot be paid", 409);
    }

    const amount = Number(booking.amount);
    if (!Number.isFinite(amount) || amount > 99999999.99) {
      throw new PaymentError(
        "The calculated payment exceeds the database amount limit",
        409
      );
    }

    const [existingPayments] = await connection.execute(
      `SELECT payment_id
       FROM PAYMENT
       WHERE booking_id = ? AND payment_status IN ('PENDING', 'PAID')
       LIMIT 1
       FOR UPDATE`,
      [bookingId]
    );

    if (existingPayments.length > 0) {
      throw new PaymentError(
        "This booking already has a pending or successful payment",
        409
      );
    }

    const [result] = await connection.execute(
      `INSERT INTO PAYMENT
        (booking_id, paid_by, amount, payment_status, paid_at)
       VALUES (?, ?, ?, 'PAID', CURRENT_TIMESTAMP)`,
      [bookingId, authorization.user.user_id, booking.amount]
    );

    await connection.commit();
    transactionOpen = false;

    return NextResponse.json(
      {
        paymentId: result.insertId,
        bookingId,
        amount: booking.amount,
        message: "Demo payment completed successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    if (transactionOpen) {
      try {
        await connection.rollback();
        transactionOpen = false;
      } catch (rollbackError) {
        console.error("Failed to roll back payment transaction:", rollbackError);
      }
    }

    if (error instanceof PaymentError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { message: "This booking already has a payment" },
        { status: 409 }
      );
    }

    console.error("Failed to process demo payment:", error);
    return NextResponse.json(
      { message: "Failed to process payment. Please try again." },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
