import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export async function authorizeRequest(
  request,
  allowedRoles = ["PASSENGER", "DRIVER", "ADMIN"]
) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  if (!allowedRoles.includes(user.role)) {
    return {
      user: null,
      response: NextResponse.json(
        { message: "You are not authorized to perform this action" },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}
