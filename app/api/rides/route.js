import { NextResponse } from "next/server";
import pool from "@/lib/mysql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pickup = searchParams.get("pickup") || "";
    const drop = searchParams.get("drop") || "";

    const [rides] = await pool.query(`
      SELECT
        ro.ride_offer_id,
        u.name AS driver_name,
        pickup.name AS pickup,
        dropoff.name AS drop_location,
        ro.departure_time,
        ro.available_seats,
        ro.cost_per_seat,
        ro.status
      FROM RIDE_OFFER ro
      JOIN USER u ON ro.user_id = u.user_id
      JOIN LOCATION pickup ON ro.pickup_location_id = pickup.location_id
      JOIN LOCATION dropoff ON ro.drop_location_id = dropoff.location_id
      WHERE ro.status = 'OPEN'
        AND ro.available_seats > 0
        AND pickup.name LIKE ?
        AND dropoff.name LIKE ?
      ORDER BY ro.departure_time ASC
    `, [`%${pickup}%`, `%${drop}%`]);

    return NextResponse.json(rides);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Failed to retrieve rides" },
      { status: 500 }
    );
  }
}
