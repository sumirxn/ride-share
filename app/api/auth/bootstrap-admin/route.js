import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { authorizeRequest } from "@/lib/api-auth";

function matchesBootstrapToken(provided, expected) {
  if (typeof provided !== "string" || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

export async function POST(request) {
  const authorization = await authorizeRequest(request, ["PASSENGER", "DRIVER"]);
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

  if (!matchesBootstrapToken(body?.bootstrapToken, process.env.ADMIN_BOOTSTRAP_TOKEN)) {
    return NextResponse.json({ message: "Invalid bootstrap token" }, { status: 403 });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [accounts] = await connection.execute(
      "SELECT user_id, role, password_hash FROM `USER` FOR UPDATE"
    );
    if (
      accounts.some(
        (account) =>
          account.role === "ADMIN" && account.password_hash.startsWith("$2")
      )
    ) {
      await connection.rollback();
      return NextResponse.json(
        { message: "An administrator is already configured" },
        { status: 409 }
      );
    }

    await connection.execute(
      "UPDATE `USER` SET role = 'ADMIN' WHERE user_id = ? AND is_active = TRUE",
      [authorization.user.user_id]
    );
    await connection.commit();
    return NextResponse.json({
      message: "Administrator access granted to the signed-in account",
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Failed to roll back admin bootstrap:", rollbackError);
      }
    }
    console.error("Failed to bootstrap administrator:", error);
    return NextResponse.json(
      { message: "Administrator setup failed" },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
