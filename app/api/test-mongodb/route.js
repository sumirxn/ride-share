import { NextResponse } from "next/server";
import getMongoClient from "@/lib/mongodb";
import { authorizeRequest } from "@/lib/api-auth";

export async function GET(request) {
  const authorization = await authorizeRequest(request, ["ADMIN"]);
  if (authorization.response) return authorization.response;

  try {
    const client = await getMongoClient();
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
