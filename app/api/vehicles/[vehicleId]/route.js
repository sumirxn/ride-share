import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { authorizeRequest } from "@/lib/api-auth";

export async function DELETE(request, context) {
  const authorization = await authorizeRequest(request, ["DRIVER"]);
  if (authorization.response) return authorization.response;

  const vehicleId = Number((await context.params).vehicleId);
  if (!Number.isSafeInteger(vehicleId) || vehicleId < 1) {
    return NextResponse.json({ message: "Invalid vehicle ID" }, { status: 400 });
  }

  try {
    const [result] = await pool.execute(
      "DELETE FROM VEHICLE WHERE vehicle_id = ? AND owner_id = ?",
      [vehicleId, authorization.user.user_id]
    );
    if (!result.affectedRows) {
      return NextResponse.json({ message: "Vehicle not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Vehicle removed successfully" });
  } catch (error) {
    if (error?.code === "ER_ROW_IS_REFERENCED_2") {
      return NextResponse.json(
        { message: "Vehicles used by ride offers cannot be removed" },
        { status: 409 }
      );
    }
    console.error("Failed to remove vehicle:", error);
    return NextResponse.json({ message: "Failed to remove vehicle" }, { status: 500 });
  }
}
