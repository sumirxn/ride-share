import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { authorizeRequest } from "@/lib/api-auth";

export async function GET(request) {
  const authorization = await authorizeRequest(request, ["ADMIN"]);
  if (authorization.response) return authorization.response;

  try {
    const [passengers] = await pool.query(`
      SELECT user_id, name
      FROM \`USER\`
      WHERE is_active = TRUE AND role = 'PASSENGER'
      ORDER BY name ASC
    `);

    return NextResponse.json(passengers);
  } catch (error) {
    console.error("Failed to retrieve active passengers:", error);
    return NextResponse.json(
      { message: "Failed to load active passengers" },
      { status: 500 }
    );
  }
}
