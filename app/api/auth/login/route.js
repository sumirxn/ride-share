import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = body?.password;
  if (
    !email ||
    email.length > 255 ||
    typeof password !== "string" ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return NextResponse.json(
      { message: "Email and password are required" },
      { status: 400 }
    );
  }

  try {
    const [users] = await pool.execute(
      `SELECT user_id, name, email, password_hash, role, is_active
       FROM \`USER\`
       WHERE email = ?`,
      [email]
    );
    const user = users[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 }
      );
    }
    if (!user.is_active) {
      return NextResponse.json(
        { message: "This account is inactive. Contact an administrator." },
        { status: 403 }
      );
    }

    const token = await createSessionToken(user.user_id);
    const role = user.role === "USER" ? "PASSENGER" : user.role;
    const response = NextResponse.json({
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role,
      },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    console.error("Failed to log in user:", error);
    return NextResponse.json(
      { message: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
