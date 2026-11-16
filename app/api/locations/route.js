import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { authorizeRequest } from "@/lib/api-auth";

export async function GET(request) {
  const authorization = await authorizeRequest(request);
  if (authorization.response) return authorization.response;

  try {
    const [locations] = await pool.query(`
      SELECT location_id, name, city
      FROM LOCATION
      ORDER BY city ASC, name ASC
    `);
    return NextResponse.json(locations);
  } catch (error) {
    console.error("Failed to load locations:", error);
    return NextResponse.json(
      { message: "Failed to load locations" },
      { status: 500 }
    );
  }
}
