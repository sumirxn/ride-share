import { NextResponse } from "next/server";
import pool from "@/lib/mysql";

export async function GET() {
  try {
    const [passengers] = await pool.query(`
      SELECT user_id, name
      FROM \`USER\`
      WHERE is_active = TRUE AND role = 'USER'
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
