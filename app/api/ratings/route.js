import { NextResponse } from "next/server";
import pool from "@/lib/mysql";
import { authorizeRequest } from "@/lib/api-auth";

class RatingError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

const ratingParticipantsQuery = `
  SELECT DISTINCT
    t.trip_id,
    pickup.name AS pickup,
    dropoff.name AS drop_location,
    driver.user_id AS rated_by_id,
    driver.name AS rated_by_name,
    passenger.user_id AS rated_to_id,
    passenger.name AS rated_to_name
  FROM TRIP t
  JOIN RIDE_OFFER ro ON ro.ride_offer_id = t.ride_offer_id
  JOIN \`USER\` driver
    ON driver.user_id = ro.user_id AND driver.is_active = TRUE
  JOIN LOCATION pickup ON pickup.location_id = ro.pickup_location_id
  JOIN LOCATION dropoff ON dropoff.location_id = ro.drop_location_id
  JOIN BOOKING b
    ON b.trip_id = t.trip_id AND b.status IN ('CONFIRMED', 'COMPLETED')
  JOIN \`MATCH\` m
    ON m.match_id = b.match_id AND m.ride_offer_id = ro.ride_offer_id
  JOIN RIDE_REQUEST rr ON rr.ride_request_id = m.ride_request_id
  JOIN \`USER\` passenger
    ON passenger.user_id = rr.user_id AND passenger.is_active = TRUE
  WHERE t.status = 'COMPLETED'
`;

export async function GET(request) {
  const authorization = await authorizeRequest(request, ["PASSENGER", "DRIVER"]);
  if (authorization.response) return authorization.response;

  try {
    const [ratingOptions] = await pool.execute(`
      SELECT DISTINCT
        eligible.trip_id,
        eligible.pickup,
        eligible.drop_location,
        eligible.rated_by_id,
        eligible.rated_by_name,
        eligible.rated_to_id,
        eligible.rated_to_name
      FROM (
        SELECT
          participants.trip_id,
          participants.pickup,
          participants.drop_location,
          participants.rated_by_id,
          participants.rated_by_name,
          participants.rated_to_id,
          participants.rated_to_name
        FROM (${ratingParticipantsQuery}) AS participants
        WHERE NOT EXISTS (
          SELECT 1
          FROM RATING existing_rating
          WHERE existing_rating.trip_id = participants.trip_id
            AND existing_rating.rated_by = participants.rated_by_id
            AND existing_rating.rated_to = participants.rated_to_id
        )

        UNION ALL

        SELECT
          participants.trip_id,
          participants.pickup,
          participants.drop_location,
          participants.rated_to_id AS rated_by_id,
          participants.rated_to_name AS rated_by_name,
          participants.rated_by_id AS rated_to_id,
          participants.rated_by_name AS rated_to_name
        FROM (${ratingParticipantsQuery}) AS participants
        WHERE NOT EXISTS (
          SELECT 1
          FROM RATING existing_rating
          WHERE existing_rating.trip_id = participants.trip_id
            AND existing_rating.rated_by = participants.rated_to_id
            AND existing_rating.rated_to = participants.rated_by_id
        )
      ) AS eligible
      WHERE eligible.rated_by_id = ?
      ORDER BY eligible.trip_id DESC, eligible.rated_by_name ASC
    `, [authorization.user.user_id]);

    return NextResponse.json(ratingOptions);
  } catch (error) {
    console.error("Failed to load rating options:", error);
    return NextResponse.json(
      { message: "Failed to load completed trip participants" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const authorization = await authorizeRequest(request, ["PASSENGER", "DRIVER"]);
  if (authorization.response) return authorization.response;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      throw new RatingError("Request body must be valid JSON", 400);
    }

    const tripId = Number(body?.tripId);
    const ratedById = Number(authorization.user.user_id);
    const ratedToId = Number(body?.ratedToId);
    const ratingValue = Number(body?.ratingValue);
    if (body?.review != null && typeof body.review !== "string") {
      throw new RatingError("Review must be text", 400);
    }
    const review =
      typeof body?.review === "string" ? body.review.trim() || null : null;

    if (!isPositiveInteger(tripId) || !isPositiveInteger(ratedToId)) {
      throw new RatingError("Select a valid trip and participant", 400);
    }

    if (ratedById === ratedToId) {
      throw new RatingError("You cannot rate yourself", 400);
    }

    if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      throw new RatingError("Rating must be a whole number from 1 to 5", 400);
    }

    if (review && review.length > 2000) {
      throw new RatingError("Review must be 2,000 characters or fewer", 400);
    }

    const participantFilter =
      authorization.user.role === "DRIVER"
        ? "(driver.user_id = ? AND passenger.user_id = ?)"
        : "(passenger.user_id = ? AND driver.user_id = ?)";
    const [eligibleParticipants] = await pool.execute(
      `${ratingParticipantsQuery}
       AND t.trip_id = ?
       AND ${participantFilter}
       LIMIT 1`,
      [tripId, ratedById, ratedToId]
    );

    if (eligibleParticipants.length === 0) {
      throw new RatingError(
        "Both users must be active participants in the selected completed trip",
        400
      );
    }

    const [result] = await pool.execute(
      `INSERT INTO RATING
        (trip_id, rated_by, rated_to, rating_value, review)
       VALUES (?, ?, ?, ?, ?)`,
      [tripId, ratedById, ratedToId, ratingValue, review]
    );

    return NextResponse.json(
      {
        ratingId: result.insertId,
        message: "Rating submitted successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RatingError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { message: "You have already rated this user for the selected trip" },
        { status: 409 }
      );
    }

    console.error("Failed to submit rating:", error);
    return NextResponse.json(
      { message: "Failed to submit rating. Please try again." },
      { status: 500 }
    );
  }
}
