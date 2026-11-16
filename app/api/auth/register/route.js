import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";

function jsonError(message, status) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON", 400);
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const password = body?.password;
  const role = body?.role ?? "PASSENGER";

  if (name.length < 2 || name.length > 100) {
    return jsonError("Name must be between 2 and 100 characters", 400);
  }
  if (
    email.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return jsonError("Enter a valid email address", 400);
  }
  if (!["PASSENGER", "DRIVER"].includes(role)) {
    return jsonError("Choose PASSENGER or DRIVER; ADMIN cannot self-register", 400);
  }
  if (phone && (phone.length > 20 || !/^[+()\d\s.-]+$/.test(phone))) {
    return jsonError("Enter a valid phone number", 400);
  }
  if (
    typeof password !== "string" ||
    Buffer.byteLength(password, "utf8") < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return jsonError("Password must be 8–72 bytes long", 400);
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      `INSERT INTO \`USER\` (name, email, phone, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`,
      [name, email, phone || null, passwordHash, role]
    );
    const token = await createSessionToken(result.insertId);
    const response = NextResponse.json(
      {
        user: {
          user_id: result.insertId,
          name,
          email,
          role,
        },
      },
      { status: 201 }
    );
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return jsonError("An account with that email or phone already exists", 409);
    }
    if (
      error?.code === "WARN_DATA_TRUNCATED" &&
      /column 'role'/i.test(error.sqlMessage || error.message || "")
    ) {
      console.error(
        "Registration is blocked until database/migrate_role_types.sql is applied:",
        error.sqlMessage
      );
      return jsonError(
        "Database roles are not updated yet. Apply database/migrate_role_types.sql, then retry registration.",
        503
      );
    }
    console.error("Failed to register user:", error);
    return jsonError("Registration failed. Please try again.", 500);
  }
}
