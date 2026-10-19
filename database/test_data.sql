USE carpooling_system;

INSERT INTO `USER` (name, email, phone, password_hash, role) VALUES
('Arun Kumar', 'arun@test.com', '9000000001', 'hash_arun', 'USER'),
('Priya Sharma', 'priya@test.com', '9000000002', 'hash_priya', 'USER'),
('Rahul Rao', 'rahul@test.com', '9000000003', 'hash_rahul', 'USER'),
('Admin User', 'admin@test.com', '9000000004', 'hash_admin', 'ADMIN');

INSERT INTO LOCATION (name, address, city, latitude, longitude) VALUES
('PES University', '100 Main Road', 'Bengaluru', 12.9345, 77.5345),
('Majestic', 'Bus Stand Road', 'Bengaluru', 12.9767, 77.5713),
('Electronic City', 'Hosur Road', 'Bengaluru', 12.8452, 77.6602);

INSERT INTO VEHICLE (owner_id, license_plate, vehicle_type, seating_capacity, fuel_type) VALUES
(1, 'KA01AB1234', 'Car', 4, 'Petrol'),
(3, 'KA02CD5678', 'Car', 5, 'Diesel');

INSERT INTO RIDE_OFFER
(user_id, vehicle_id, pickup_location_id, drop_location_id,
 departure_time, available_seats, cost_per_seat, status)
VALUES
(1, 1, 1, 2, '2026-11-01 09:00:00', 3, 100.00, 'OPEN'),
(3, 2, 2, 3, '2026-11-01 10:00:00', 4, 150.00, 'OPEN');

INSERT INTO RIDE_REQUEST
(user_id, pickup_location_id, drop_location_id, requested_time,
 seats_required, max_detour_minutes, status)
VALUES
(2, 1, 2, '2026-11-01 09:00:00', 1, 15, 'OPEN'),
(2, 2, 3, '2026-11-01 10:00:00', 2, 20, 'OPEN');

INSERT INTO `MATCH` (ride_offer_id, ride_request_id, match_score) VALUES
(1, 1, 95.00),
(2, 2, 88.00);

INSERT INTO TRIP (ride_offer_id, start_time, status) VALUES
(1, '2026-11-01 09:00:00', 'SCHEDULED'),
(2, '2026-11-01 10:00:00', 'SCHEDULED');

INSERT INTO BOOKING (match_id, trip_id, seats_booked, status) VALUES
(1, 1, 1, 'CONFIRMED');

INSERT INTO PAYMENT (booking_id, paid_by, amount, payment_status) VALUES
(1, 2, 100.00, 'PAID');

INSERT INTO RATING (trip_id, rated_by, rated_to, rating_value, review) VALUES
(1, 2, 1, 5, 'Great ride');

INSERT INTO CANCELLATION
(booking_id, cancelled_by, reason, penalty_amount)
VALUES
(1, 2, 'Test cancellation record', 0.00);
