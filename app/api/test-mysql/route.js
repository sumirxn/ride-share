import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { authorizeRequest } from "@/lib/api-auth";

export async function GET(request) {
  const authorization = await authorizeRequest(request, ["ADMIN"]);
  if (authorization.response) return authorization.response;

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
