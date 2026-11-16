import { SignJWT, jwtVerify } from "jose";
import pool from "@/lib/mysql";

export const SESSION_COOKIE = "carpool_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function getAuthenticatedUser(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let userId;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
    });
    userId = Number(payload.sub);
  } catch {
    return null;
  }

  if (!Number.isSafeInteger(userId) || userId < 1) return null;

  const [users] = await pool.execute(
    `SELECT user_id, name, email, role
     FROM \`USER\`
     WHERE user_id = ? AND is_active = TRUE`,
    [userId]
  );
  const user = users[0];
  if (user?.role === "USER") {
    return { ...user, role: "PASSENGER" };
  }
  return user || null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}
