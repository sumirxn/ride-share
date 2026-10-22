USE carpooling_system;

-- 1. USERS
INSERT INTO `USER` (name, email, phone, password_hash, role) VALUES
('Arun Kumar', 'arun@test.com', '9000000001', 'hash_arun', 'USER'),
('Priya Sharma', 'priya@test.com', '9000000002', 'hash_priya', 'USER'),
('Rahul Rao', 'rahul@test.com', '9000000003', 'hash_rahul', 'USER'),
('Admin User', 'admin@test.com', '9000000004', 'hash_admin', 'ADMIN'),
('Sneha Reddy', 'sneha@test.com', '9000000005', 'hash_sneha', 'USER'),
('Vikram Singh', 'vikram@test.com', '9000000006', 'hash_vikram', 'USER'),
('Ananya Das', 'ananya@test.com', '9000000007', 'hash_ananya', 'USER'),
('Karan Mehta', 'karan@test.com', '9000000008', 'hash_karan', 'USER');

-- 2. LOCATIONS
INSERT INTO LOCATION (name, address, city, latitude, longitude) VALUES
('PES University', '100 Main Road', 'Bengaluru', 12.9345, 77.5345),
('Majestic', 'Bus Stand Road', 'Bengaluru', 12.9767, 77.5713),
('Electronic City', 'Hosur Road', 'Bengaluru', 12.8452, 77.6602),
('Indiranagar', '100 Feet Road', 'Bengaluru', 12.9784, 77.6408),
('Koramangala', '80 Feet Road', 'Bengaluru', 12.9352, 77.6245),
('Whitefield', 'ITPL Main Road', 'Bengaluru', 12.9698, 77.7500);

-- 3. VEHICLES
INSERT INTO VEHICLE (owner_id, license_plate, vehicle_type, seating_capacity, fuel_type) VALUES
(1, 'KA01AB1234', 'Car', 4, 'Petrol'),
(3, 'KA02CD5678', 'Car', 5, 'Diesel'),
(5, 'KA03EF1001', 'Car', 4, 'Petrol'),
(6, 'KA04GH1002', 'Car', 5, 'Diesel'),
(7, 'KA05IJ1003', 'Car', 4, 'Electric'),
(8, 'KA03KL1004', 'Car', 5, 'Petrol');

-- 4. RIDE OFFERS
INSERT INTO RIDE_OFFER
(user_id, vehicle_id, pickup_location_id, drop_location_id,
 departure_time, available_seats, cost_per_seat, status)
VALUES
(1, 1, 1, 2, '2026-11-01 09:00:00', 3, 100.00, 'OPEN'),
(3, 2, 2, 3, '2026-11-01 10:00:00', 4, 150.00, 'OPEN'),
(5, 3, 4, 5, '2026-11-01 08:30:00', 2, 80.00, 'OPEN'),
(6, 4, 5, 6, '2026-11-01 09:30:00', 3, 120.00, 'OPEN'),
(7, 5, 6, 1, '2026-11-01 11:00:00', 2, 90.00, 'COMPLETED'),
(8, 6, 4, 3, '2026-11-01 12:00:00', 3, 180.00, 'OPEN');

-- 5. RIDE REQUESTS
INSERT INTO RIDE_REQUEST
(user_id, pickup_location_id, drop_location_id, requested_time,
 seats_required, max_detour_minutes, status)
VALUES
(2, 1, 2, '2026-11-01 09:00:00', 1, 15, 'BOOKED'),
(2, 2, 3, '2026-11-01 10:00:00', 2, 20, 'BOOKED'),
(4, 4, 5, '2026-11-01 08:30:00', 1, 10, 'BOOKED'),
(5, 5, 6, '2026-11-01 09:30:00', 2, 15, 'BOOKED'),
(6, 6, 1, '2026-11-01 11:00:00', 1, 20, 'BOOKED'),
(7, 4, 3, '2026-11-01 12:00:00', 2, 15, 'OPEN');

-- 6. MATCHES
INSERT INTO `MATCH` (ride_offer_id, ride_request_id, match_score) VALUES
(1, 1, 95.00),
(2, 2, 88.00),
(3, 3, 92.00),
(4, 4, 85.00),
(5, 5, 97.00);

-- 7. TRIPS
INSERT INTO TRIP
(ride_offer_id, start_time, end_time, total_distance_km, status)
VALUES
(1, '2026-11-01 09:00:00', NULL, NULL, 'SCHEDULED'),
(2, '2026-11-01 10:00:00', NULL, NULL, 'SCHEDULED'),
(3, '2026-11-01 08:30:00', '2026-11-01 09:00:00', 8.50, 'COMPLETED'),
(4, '2026-11-01 09:30:00', '2026-11-01 10:15:00', 12.20, 'COMPLETED'),
(5, '2026-11-01 11:00:00', '2026-11-01 11:40:00', 15.00, 'COMPLETED'),
(6, '2026-11-01 12:00:00', NULL, NULL, 'SCHEDULED');

-- 8. BOOKINGS
INSERT INTO BOOKING (match_id, trip_id, seats_booked, status) VALUES
(1, 1, 1, 'CONFIRMED'),
(2, 2, 2, 'CONFIRMED'),
(3, 3, 1, 'COMPLETED'),
(4, 4, 2, 'COMPLETED'),
(5, 5, 1, 'COMPLETED');

-- 9. PAYMENTS
INSERT INTO PAYMENT
(booking_id, paid_by, amount, payment_status, paid_at)
VALUES
(1, 2, 100.00, 'PAID', '2026-10-30 12:00:00'),
(2, 2, 300.00, 'PENDING', NULL),
(3, 4, 80.00, 'PAID', '2026-11-01 09:05:00'),
(4, 5, 240.00, 'PAID', '2026-11-01 10:20:00'),
(5, 6, 90.00, 'FAILED', NULL);

-- 10. CANCELLATIONS
INSERT INTO CANCELLATION
(booking_id, cancelled_by, reason, penalty_amount)
VALUES
(3, 4, 'Test cancellation record', 0.00);

-- 11. RATINGS
INSERT INTO RATING
(trip_id, rated_by, rated_to, rating_value, review)
VALUES
(3, 4, 5, 5, 'Great ride'),
(4, 5, 6, 4, 'Comfortable journey'),
(5, 6, 7, 5, 'Excellent driver'),
(3, 5, 4, 4, 'Friendly passenger');
