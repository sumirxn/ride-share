import { NextResponse } from "next/server";
import getMongoClient from "@/lib/mongodb";
import { authorizeRequest } from "@/lib/api-auth";

export async function POST(request) {
  const authorization = await authorizeRequest(request, ["PASSENGER"]);
  if (authorization.response) return authorization.response;

  try {
    const body = await request.json();

    const { pickup, drop, seatsRequired } = body;

    if (!pickup || !drop || !seatsRequired || seatsRequired < 1) {
      return NextResponse.json(
        { message: "Invalid ride search details" },
        { status: 400 }
      );
    }

    const client = await getMongoClient();
    const db = client.db("carpooling_system");

    const result = await db.collection("ride_activity").insertOne({
      userId: authorization.user.user_id,
      activityType: "RIDE_SEARCH",
      pickup,
      drop,
      seatsRequired: Number(seatsRequired),
      createdAt: new Date()
    });

    return NextResponse.json({
      message: "Ride activity recorded",
      activityId: result.insertedId
    });
  } catch (error) {
    console.error("Failed to record ride activity:", error);
    return NextResponse.json(
      { message: "Ride activity analytics are temporarily unavailable" },
      { status: 503 }
    );
  }
}
