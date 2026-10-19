import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    await client.db("carpooling_system").command({ ping: 1 });

    return NextResponse.json({ message: "MongoDB connected successfully" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "MongoDB connection failed" },
      { status: 500 }
    );
  }
}
