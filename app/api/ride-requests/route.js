import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { authorizeRequest } from "@/lib/api-auth";

class RideRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function toMysqlDateTime(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date(year, month - 1, day, hour, minute);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }
  return `${yearText}-${monthText}-${dayText} ${hourText}:${minuteText}:00`;
}

export async function GET(request) {
  const authorization = await authorizeRequest(request, ["PASSENGER"]);
  if (authorization.response) return authorization.response;

  try {
    const [requests] = await pool.execute(
      `SELECT rr.ride_request_id, rr.requested_time, rr.seats_required,
              rr.max_detour_minutes, rr.status,
              pickup.name AS pickup, dropoff.name AS drop_location
       FROM RIDE_REQUEST rr
       JOIN LOCATION pickup ON pickup.location_id = rr.pickup_location_id
       JOIN LOCATION dropoff ON dropoff.location_id = rr.drop_location_id
       WHERE rr.user_id = ?
       ORDER BY rr.created_at DESC`,
      [authorization.user.user_id]
    );
    return NextResponse.json(requests);
  } catch (error) {
    console.error("Failed to load ride requests:", error);
    return NextResponse.json(
      { message: "Failed to load ride requests" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const authorization = await authorizeRequest(request, ["PASSENGER"]);
  if (authorization.response) return authorization.response;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      throw new RideRequestError("Request body must be valid JSON", 400);
    }

    const pickupLocationId = Number(body?.pickupLocationId);
    const dropLocationId = Number(body?.dropLocationId);
    const requestedTime = toMysqlDateTime(body?.requestedTime);
    const seatsRequired = Number(body?.seatsRequired);
    const maxDetourMinutes = Number(body?.maxDetourMinutes ?? 0);

    if (
      !isPositiveInteger(pickupLocationId) ||
      !isPositiveInteger(dropLocationId) ||
      pickupLocationId === dropLocationId ||
      !requestedTime ||
      !isPositiveInteger(seatsRequired) ||
      !Number.isSafeInteger(maxDetourMinutes) ||
      maxDetourMinutes < 0
    ) {
      throw new RideRequestError("Enter valid ride request details", 400);
    }

    const [locations] = await pool.execute(
      "SELECT location_id FROM LOCATION WHERE location_id IN (?, ?)",
      [pickupLocationId, dropLocationId]
    );
    if (locations.length !== 2) {
      throw new RideRequestError("Select valid pickup and drop locations", 404);
    }

    const [result] = await pool.execute(
      `INSERT INTO RIDE_REQUEST
        (user_id, pickup_location_id, drop_location_id, requested_time,
         seats_required, max_detour_minutes, status)
       VALUES (?, ?, ?, ?, ?, ?, 'OPEN')`,
      [
        authorization.user.user_id,
        pickupLocationId,
        dropLocationId,
        requestedTime,
        seatsRequired,
        maxDetourMinutes,
      ]
    );
    return NextResponse.json(
      {
        rideRequestId: result.insertId,
        message: "Ride request created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RideRequestError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("Failed to create ride request:", error);
    return NextResponse.json(
      { message: "Failed to create ride request. Please try again." },
      { status: 500 }
    );
  }
}
