import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { authorizeRequest } from "@/lib/api-auth";

class RideOfferError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function toMysqlDateTime(value) {
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
    year < 1000 ||
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
  const authorization = await authorizeRequest(request, ["DRIVER"]);
  if (authorization.response) return authorization.response;

  try {
    const [vehicles, locations, offers] = await Promise.all([
      pool.execute(`
        SELECT v.vehicle_id, v.owner_id, v.license_plate,
               v.vehicle_type, v.seating_capacity
        FROM VEHICLE v
        JOIN \`USER\` u ON u.user_id = v.owner_id
        WHERE u.is_active = TRUE AND v.owner_id = ?
        ORDER BY v.license_plate ASC
      `, [authorization.user.user_id]),
      pool.query(`
        SELECT location_id, name, city
        FROM LOCATION
        ORDER BY city ASC, name ASC
      `),
      pool.execute(`
        SELECT ro.ride_offer_id, ro.departure_time, ro.available_seats,
               ro.cost_per_seat, ro.status, pickup.name AS pickup,
               dropoff.name AS drop_location, t.trip_id, t.status AS trip_status
        FROM RIDE_OFFER ro
        JOIN LOCATION pickup ON pickup.location_id = ro.pickup_location_id
        JOIN LOCATION dropoff ON dropoff.location_id = ro.drop_location_id
        JOIN TRIP t ON t.ride_offer_id = ro.ride_offer_id
        WHERE ro.user_id = ?
        ORDER BY ro.departure_time DESC
      `, [authorization.user.user_id]),
    ]);

    return NextResponse.json({
      vehicles: vehicles[0],
      locations: locations[0],
      offers: offers[0],
    });
  } catch (error) {
    console.error("Failed to load ride offer options:", error);
    return NextResponse.json(
      { message: "Failed to load drivers, vehicles and locations" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const authorization = await authorizeRequest(request, ["DRIVER"]);
  if (authorization.response) return authorization.response;

  let connection;
  let transactionOpen = false;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      throw new RideOfferError("Request body must be valid JSON", 400);
    }

    const driverId = Number(authorization.user.user_id);
    const vehicleId = Number(body?.vehicleId);
    const pickupLocationId = Number(body?.pickupLocationId);
    const dropLocationId = Number(body?.dropLocationId);
    const availableSeats = Number(body?.availableSeats);
    const costPerSeat = Number(body?.costPerSeat);
    const departureTime = toMysqlDateTime(body?.departureTime);

    if (
      !isPositiveInteger(vehicleId) ||
      !isPositiveInteger(pickupLocationId) ||
      !isPositiveInteger(dropLocationId) ||
      !isPositiveInteger(availableSeats)
    ) {
      throw new RideOfferError(
        "Driver, vehicle, locations and seat count must be valid",
        400
      );
    }

    if (pickupLocationId === dropLocationId) {
      throw new RideOfferError("Pickup and drop locations must be different", 400);
    }

    if (!departureTime) {
      throw new RideOfferError("Enter a valid departure date and time", 400);
    }

    if (
      !Number.isFinite(costPerSeat) ||
      costPerSeat < 0 ||
      costPerSeat > 99999999.99 ||
      !/^\d+(?:\.\d{1,2})?$/.test(String(body.costPerSeat))
    ) {
      throw new RideOfferError(
        "Cost per seat must be between 0 and 99,999,999.99 with at most two decimals",
        400
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionOpen = true;

    const [vehicles] = await connection.execute(
      `SELECT v.vehicle_id, v.seating_capacity
       FROM VEHICLE v
       JOIN \`USER\` u ON u.user_id = v.owner_id
       WHERE v.vehicle_id = ? AND v.owner_id = ? AND u.is_active = TRUE`,
      [vehicleId, driverId]
    );
    const vehicle = vehicles[0];
    if (!vehicle) {
      throw new RideOfferError(
        "Selected vehicle does not belong to this driver",
        400
      );
    }

    if (availableSeats > vehicle.seating_capacity) {
      throw new RideOfferError(
        `Available seats cannot exceed this vehicle's capacity of ${vehicle.seating_capacity}`,
        400
      );
    }

    const [locations] = await connection.execute(
      "SELECT location_id FROM LOCATION WHERE location_id IN (?, ?)",
      [pickupLocationId, dropLocationId]
    );
    if (locations.length !== 2) {
      throw new RideOfferError("Select valid pickup and drop locations", 404);
    }

    const [offerResult] = await connection.execute(
      `INSERT INTO RIDE_OFFER
        (user_id, vehicle_id, pickup_location_id, drop_location_id,
         departure_time, available_seats, cost_per_seat, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
      [
        driverId,
        vehicleId,
        pickupLocationId,
        dropLocationId,
        departureTime,
        availableSeats,
        costPerSeat,
      ]
    );

    const [tripResult] = await connection.execute(
      `INSERT INTO TRIP (ride_offer_id, start_time, status)
       VALUES (?, ?, 'SCHEDULED')`,
      [offerResult.insertId, departureTime]
    );

    await connection.commit();
    transactionOpen = false;

    return NextResponse.json(
      {
        rideOfferId: offerResult.insertId,
        tripId: tripResult.insertId,
        message: "Ride offer created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    if (transactionOpen) {
      try {
        await connection.rollback();
        transactionOpen = false;
      } catch (rollbackError) {
        console.error("Failed to roll back ride offer creation:", rollbackError);
      }
    }

    if (error instanceof RideOfferError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("Failed to create ride offer:", error);
    return NextResponse.json(
      { message: "Failed to create ride offer. Please try again." },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
