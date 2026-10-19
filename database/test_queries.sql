USE carpooling_system;

-- 1. Display all available ride offers
SELECT *
FROM RIDE_OFFER
WHERE status = 'OPEN';

-- 2. Display ride offers with driver and location details
SELECT ro.ride_offer_id, u.name AS driver,
       l1.name AS pickup, l2.name AS drop_location,
       ro.departure_time, ro.available_seats, ro.cost_per_seat
FROM RIDE_OFFER ro
JOIN `USER` u ON ro.user_id = u.user_id
JOIN LOCATION l1 ON ro.pickup_location_id = l1.location_id
JOIN LOCATION l2 ON ro.drop_location_id = l2.location_id;

-- 3. Display ride requests with passenger details
SELECT rr.ride_request_id, u.name AS passenger,
       l1.name AS pickup, l2.name AS drop_location,
       rr.requested_time, rr.seats_required
FROM RIDE_REQUEST rr
JOIN `USER` u ON rr.user_id = u.user_id
JOIN LOCATION l1 ON rr.pickup_location_id = l1.location_id
JOIN LOCATION l2 ON rr.drop_location_id = l2.location_id;

-- 4. Display matching offers and requests
SELECT m.match_id, m.match_score,
       ro.ride_offer_id, rr.ride_request_id
FROM `MATCH` m
JOIN RIDE_OFFER ro ON m.ride_offer_id = ro.ride_offer_id
JOIN RIDE_REQUEST rr ON m.ride_request_id = rr.ride_request_id
ORDER BY m.match_score DESC;

-- 5. Display bookings with passenger and trip details
SELECT b.booking_id, u.name AS passenger,
       b.seats_booked, b.status AS booking_status,
       t.trip_id, t.status AS trip_status
FROM BOOKING b
JOIN `MATCH` m ON b.match_id = m.match_id
JOIN RIDE_REQUEST rr ON m.ride_request_id = rr.ride_request_id
JOIN `USER` u ON rr.user_id = u.user_id
JOIN TRIP t ON b.trip_id = t.trip_id;

-- 6. Calculate total bookings and seats booked
SELECT COUNT(*) AS total_bookings,
       COALESCE(SUM(seats_booked), 0) AS total_seats_booked
FROM BOOKING
WHERE status = 'CONFIRMED';

-- 7. Calculate average rating for each user
SELECT u.user_id, u.name,
       COALESCE(AVG(r.rating_value), 0) AS average_rating,
       COUNT(r.rating_id) AS total_ratings
FROM `USER` u
LEFT JOIN RATING r ON u.user_id = r.rated_to
GROUP BY u.user_id, u.name;

-- 8. Display users whose average rating is above the overall average
SELECT user_id, name, rating_avg
FROM `USER`
WHERE rating_avg > (
    SELECT AVG(rating_avg)
    FROM `USER`
    WHERE rating_avg > 0
);

-- 9. Calculate total payment amount by payment status
SELECT payment_status, SUM(amount) AS total_amount
FROM PAYMENT
GROUP BY payment_status;

-- 10. Display completed trips and their distances
SELECT trip_id, start_time, end_time, total_distance_km
FROM TRIP
WHERE status = 'COMPLETED';

-- 11. Display cancellation details
SELECT c.cancellation_id, c.booking_id,
       u.name AS cancelled_by, c.reason, c.penalty_amount
FROM CANCELLATION c
JOIN `USER` u ON c.cancelled_by = u.user_id;

-- 12. Display users who have never made a ride request
SELECT u.user_id, u.name
FROM `USER` u
WHERE NOT EXISTS (
    SELECT 1
    FROM RIDE_REQUEST rr
    WHERE rr.user_id = u.user_id
);

-- 13. Calculate total revenue from successful payments
SELECT COALESCE(SUM(amount), 0) AS total_revenue
FROM PAYMENT
WHERE payment_status = 'PAID';

-- 14. Count ride offers by status
SELECT status, COUNT(*) AS total_offers
FROM RIDE_OFFER
GROUP BY status;