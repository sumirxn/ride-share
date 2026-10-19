import { NextResponse } from "next/server";
import pool from "@/lib/mysql";

export async function GET() {
  try {
    const [rows] = await pool.query("SELECT DATABASE() AS databaseName");

    return NextResponse.json({
      message: "MySQL connected successfully",
      database: rows[0].databaseName
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "MySQL connection failed" },
      { status: 500 }
    );
  }
}
