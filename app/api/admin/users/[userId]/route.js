import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { authorizeRequest } from "@/lib/api-auth";

export async function PATCH(request, context) {
  const authorization = await authorizeRequest(request, ["ADMIN"]);
  if (authorization.response) return authorization.response;

  const userId = Number((await context.params).userId);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    return NextResponse.json({ message: "Invalid user ID" }, { status: 400 });
  }
  if (userId === Number(authorization.user.user_id)) {
    return NextResponse.json(
      { message: "You cannot change your own account access" },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const hasRole = Object.prototype.hasOwnProperty.call(body, "role");
  const hasActive = Object.prototype.hasOwnProperty.call(body, "isActive");
  if (
    (!hasRole && !hasActive) ||
    (hasRole && !["PASSENGER", "DRIVER", "ADMIN"].includes(body.role)) ||
    (hasActive && typeof body.isActive !== "boolean")
  ) {
    return NextResponse.json(
      { message: "Provide a valid role and/or active status" },
      { status: 400 }
    );
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [targetUsers] = await connection.execute(
      "SELECT user_id, role, is_active FROM `USER` WHERE user_id = ? FOR UPDATE",
      [userId]
    );
    const target = targetUsers[0];
    if (!target) {
      await connection.rollback();
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const nextRole = hasRole ? body.role : target.role;
    const nextActive = hasActive ? body.isActive : Boolean(target.is_active);
    if (target.role === "ADMIN" && target.is_active && (nextRole !== "ADMIN" || !nextActive)) {
      const [admins] = await connection.execute(
        "SELECT user_id FROM `USER` WHERE role = 'ADMIN' AND is_active = TRUE FOR UPDATE"
      );
      if (admins.length <= 1) {
        await connection.rollback();
        return NextResponse.json(
          { message: "The last active administrator cannot be removed" },
          { status: 409 }
        );
      }
    }

    const assignments = [];
    const values = [];
    if (hasRole) {
      assignments.push("role = ?");
      values.push(body.role);
    }
    if (hasActive) {
      assignments.push("is_active = ?");
      values.push(body.isActive);
    }
    values.push(userId);
    await connection.execute(
      `UPDATE \`USER\` SET ${assignments.join(", ")} WHERE user_id = ?`,
      values
    );
    await connection.commit();
    return NextResponse.json({
      message: "User access updated successfully",
      userId,
      role: nextRole,
      isActive: nextActive,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Failed to roll back user access update:", rollbackError);
      }
    }
    console.error("Failed to update user access:", error);
    return NextResponse.json(
      { message: "Failed to update user access" },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
