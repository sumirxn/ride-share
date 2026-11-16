import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { authorizeRequest } from "@/lib/api-auth";

export async function PATCH(request, context) {
  const authorization = await authorizeRequest(request, ["DRIVER"]);
  if (authorization.response) return authorization.response;

  const rideOfferId = Number((await context.params).rideOfferId);
  if (!Number.isSafeInteger(rideOfferId) || rideOfferId < 1) {
    return NextResponse.json({ message: "Invalid ride offer ID" }, { status: 400 });
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
  if (body?.status !== "CANCELLED") {
    return NextResponse.json(
      { message: "Drivers may only cancel their own ride offers" },
      { status: 400 }
    );
  }

  let connection;
  let transactionOpen = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionOpen = true;
    const [offers] = await connection.execute(
      `SELECT ro.ride_offer_id, ro.status, t.trip_id, t.status AS trip_status
       FROM RIDE_OFFER ro
       JOIN TRIP t ON t.ride_offer_id = ro.ride_offer_id
       WHERE ro.ride_offer_id = ? AND ro.user_id = ?
       FOR UPDATE`,
      [rideOfferId, authorization.user.user_id]
    );
    const offer = offers[0];
    if (!offer) {
      await connection.rollback();
      transactionOpen = false;
      return NextResponse.json({ message: "Ride offer not found" }, { status: 404 });
    }
    if (
      !["OPEN", "FULL"].includes(offer.status) ||
      offer.trip_status !== "SCHEDULED"
    ) {
      throw Object.assign(new Error("This ride offer can no longer be cancelled"), {
        status: 409,
      });
    }

    const [bookings] = await connection.execute(
      `SELECT booking_id
       FROM BOOKING
       WHERE trip_id = ? AND status = 'CONFIRMED'
       LIMIT 1
       FOR UPDATE`,
      [offer.trip_id]
    );
    if (bookings.length) {
      throw Object.assign(
        new Error("Cancel its confirmed bookings before cancelling this offer"),
        { status: 409 }
      );
    }

    await connection.execute(
      "UPDATE RIDE_OFFER SET status = 'CANCELLED' WHERE ride_offer_id = ?",
      [rideOfferId]
    );
    await connection.execute(
      "UPDATE TRIP SET status = 'CANCELLED' WHERE trip_id = ?",
      [offer.trip_id]
    );
    await connection.commit();
    transactionOpen = false;
    return NextResponse.json({ message: "Ride offer cancelled successfully" });
  } catch (error) {
    if (transactionOpen) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Failed to roll back ride offer cancellation:", rollbackError);
      }
    }
    if (error.status === 409) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    console.error("Failed to cancel ride offer:", error);
    return NextResponse.json(
      { message: "Failed to cancel ride offer" },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
