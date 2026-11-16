import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { authorizeRequest } from "@/lib/api-auth";

function validateVehicle(body) {
  const licensePlate =
    typeof body?.licensePlate === "string" ? body.licensePlate.trim() : "";
  const vehicleType =
    typeof body?.vehicleType === "string" ? body.vehicleType.trim() : "";
  const seatingCapacity = Number(body?.seatingCapacity);
  const fuelType =
    typeof body?.fuelType === "string" ? body.fuelType.trim() : "";

  if (
    licensePlate.length < 1 ||
    licensePlate.length > 20 ||
    vehicleType.length < 1 ||
    vehicleType.length > 50 ||
    !Number.isSafeInteger(seatingCapacity) ||
    seatingCapacity < 1 ||
    seatingCapacity > 1000 ||
    fuelType.length > 30
  ) {
    return null;
  }
  return { licensePlate, vehicleType, seatingCapacity, fuelType: fuelType || null };
}

export async function GET(request) {
  const authorization = await authorizeRequest(request, ["DRIVER"]);
  if (authorization.response) return authorization.response;

  try {
    const [vehicles] = await pool.execute(
      `SELECT vehicle_id, license_plate, vehicle_type, seating_capacity, fuel_type
       FROM VEHICLE
       WHERE owner_id = ?
       ORDER BY vehicle_id DESC`,
      [authorization.user.user_id]
    );
    return NextResponse.json(vehicles);
  } catch (error) {
    console.error("Failed to load driver vehicles:", error);
    return NextResponse.json(
      { message: "Failed to load vehicles" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const authorization = await authorizeRequest(request, ["DRIVER"]);
  if (authorization.response) return authorization.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Request body must be valid JSON" },
      { status: 400 }
    );
  }
  const vehicle = validateVehicle(body);
  if (!vehicle) {
    return NextResponse.json({ message: "Enter valid vehicle details" }, { status: 400 });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO VEHICLE
        (owner_id, license_plate, vehicle_type, seating_capacity, fuel_type)
       VALUES (?, ?, ?, ?, ?)`,
      [
        authorization.user.user_id,
        vehicle.licensePlate,
        vehicle.vehicleType,
        vehicle.seatingCapacity,
        vehicle.fuelType,
      ]
    );
    return NextResponse.json(
      { vehicleId: result.insertId, message: "Vehicle registered successfully" },
      { status: 201 }
    );
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { message: "That license plate is already registered" },
        { status: 409 }
      );
    }
    console.error("Failed to register vehicle:", error);
    return NextResponse.json(
      { message: "Failed to register vehicle" },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  const authorization = await authorizeRequest(request, ["DRIVER"]);
  if (authorization.response) return authorization.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Request body must be valid JSON" },
      { status: 400 }
    );
  }
  const vehicleId = Number(body?.vehicleId);
  const vehicle = validateVehicle(body);
  if (!Number.isSafeInteger(vehicleId) || vehicleId < 1 || !vehicle) {
    return NextResponse.json(
      { message: "Enter a valid vehicle ID and vehicle details" },
      { status: 400 }
    );
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [vehicles] = await connection.execute(
      "SELECT vehicle_id FROM VEHICLE WHERE vehicle_id = ? AND owner_id = ? FOR UPDATE",
      [vehicleId, authorization.user.user_id]
    );
    if (!vehicles.length) {
      await connection.rollback();
      return NextResponse.json({ message: "Vehicle not found" }, { status: 404 });
    }
    const [offers] = await connection.execute(
      `SELECT COUNT(*) AS offer_count
       FROM RIDE_OFFER
       WHERE vehicle_id = ?`,
      [vehicleId]
    );
    const [existingVehicle] = await connection.execute(
      "SELECT seating_capacity FROM VEHICLE WHERE vehicle_id = ?",
      [vehicleId]
    );
    if (
      Number(offers[0].offer_count) > 0 &&
      vehicle.seatingCapacity < Number(existingVehicle[0].seating_capacity)
    ) {
      await connection.rollback();
      return NextResponse.json(
        { message: "Capacity cannot be reduced after this vehicle has ride offers" },
        { status: 409 }
      );
    }
    await connection.execute(
      `UPDATE VEHICLE
       SET license_plate = ?, vehicle_type = ?, seating_capacity = ?, fuel_type = ?
       WHERE vehicle_id = ? AND owner_id = ?`,
      [
        vehicle.licensePlate,
        vehicle.vehicleType,
        vehicle.seatingCapacity,
        vehicle.fuelType,
        vehicleId,
        authorization.user.user_id,
      ]
    );
    await connection.commit();
    return NextResponse.json({ message: "Vehicle updated successfully" });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Failed to roll back vehicle update:", rollbackError);
      }
    }
    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { message: "That license plate is already registered" },
        { status: 409 }
      );
    }
    console.error("Failed to update vehicle:", error);
    return NextResponse.json(
      { message: "Failed to update vehicle" },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
