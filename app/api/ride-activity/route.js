import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function POST(request) {
  try {
    const body = await request.json();

    const { userId, pickup, drop, seatsRequired } = body;

    if (!pickup || !drop || !seatsRequired || seatsRequired < 1) {
      return NextResponse.json(
        { message: "Invalid ride search details" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("carpooling_system");

    const result = await db.collection("ride_activity").insertOne({
      userId: userId || null,
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
    console.error(error);
    return NextResponse.json(
      { message: "Failed to record ride activity" },
      { status: 500 }
    );
  }
}
