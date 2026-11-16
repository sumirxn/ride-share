import { NextResponse } from "next/server";
import getMongoClient from "@/lib/mongodb";
import { authorizeRequest } from "@/lib/api-auth";

export async function GET(request) {
  const authorization = await authorizeRequest(request);
  if (authorization.response) return authorization.response;

  try {
    const client = await getMongoClient();
    const db = client.db("carpooling_system");

    const routes = await db.collection("ride_activity").aggregate([
      {
        $match: { activityType: "RIDE_SEARCH" }
      },
      {
        $group: {
          _id: {
            pickup: "$pickup",
            drop: "$drop"
          },
          searchCount: { $sum: 1 }
        }
      },
      {
        $sort: { searchCount: -1 }
      }
    ]).toArray();

    return NextResponse.json(routes);
  } catch (error) {
    console.error("Failed to retrieve popular routes:", error);
    return NextResponse.json(
      { message: "Popular-route analytics are temporarily unavailable" },
      { status: 503 }
    );
  }
}
