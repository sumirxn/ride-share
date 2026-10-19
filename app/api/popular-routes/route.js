import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
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
    console.error(error);
    return NextResponse.json(
      { message: "Failed to retrieve popular routes" },
      { status: 500 }
    );
  }
}
