
CREATE DATABASE IF NOT EXISTS carpooling_system;
USE carpooling_system;

CREATE TABLE `USER` (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    rating_avg DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (rating_avg BETWEEN 0 AND 5)
);

CREATE TABLE LOCATION (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE VEHICLE (
    vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    license_plate VARCHAR(20) NOT NULL UNIQUE,
    vehicle_type VARCHAR(50) NOT NULL,
    seating_capacity INT NOT NULL,
    fuel_type VARCHAR(30),
    UNIQUE (vehicle_id, owner_id),
    FOREIGN KEY (owner_id) REFERENCES `USER`(user_id),
    CHECK (seating_capacity > 0)
);

CREATE TABLE RIDE_OFFER (
    ride_offer_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    pickup_location_id INT NOT NULL,
    drop_location_id INT NOT NULL,
    departure_time DATETIME NOT NULL,
    available_seats INT NOT NULL,
    cost_per_seat DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('OPEN', 'FULL', 'CANCELLED', 'COMPLETED')
        NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id, user_id)
        REFERENCES VEHICLE(vehicle_id, owner_id),
    FOREIGN KEY (pickup_location_id)
        REFERENCES LOCATION(location_id),
    FOREIGN KEY (drop_location_id)
        REFERENCES LOCATION(location_id),
    CHECK (available_seats >= 0),
    CHECK (cost_per_seat >= 0),
    CHECK (pickup_location_id <> drop_location_id)
);

CREATE TABLE RIDE_REQUEST (
    ride_request_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    pickup_location_id INT NOT NULL,
    drop_location_id INT NOT NULL,
    requested_time DATETIME NOT NULL,
    seats_required INT NOT NULL DEFAULT 1,
    max_detour_minutes INT NOT NULL DEFAULT 0,
    status ENUM('OPEN', 'MATCHED', 'BOOKED', 'CANCELLED')
        NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES `USER`(user_id),
    FOREIGN KEY (pickup_location_id)
        REFERENCES LOCATION(location_id),
    FOREIGN KEY (drop_location_id)
        REFERENCES LOCATION(location_id),
    CHECK (seats_required > 0),
    CHECK (max_detour_minutes >= 0),
    CHECK (pickup_location_id <> drop_location_id)
);

CREATE TABLE `MATCH` (
    match_id INT AUTO_INCREMENT PRIMARY KEY,
    ride_offer_id INT NOT NULL,
    ride_request_id INT NOT NULL,
    match_score DECIMAL(5,2) NOT NULL,
    matched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (ride_offer_id, ride_request_id),
    FOREIGN KEY (ride_offer_id)
        REFERENCES RIDE_OFFER(ride_offer_id),
    FOREIGN KEY (ride_request_id)
        REFERENCES RIDE_REQUEST(ride_request_id),
    CHECK (match_score BETWEEN 0 AND 100)
);

CREATE TABLE TRIP (
    trip_id INT AUTO_INCREMENT PRIMARY KEY,
    ride_offer_id INT NOT NULL UNIQUE,
    start_time DATETIME,
    end_time DATETIME,
    total_distance_km DECIMAL(10,2),
    status ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
        NOT NULL DEFAULT 'SCHEDULED',
    FOREIGN KEY (ride_offer_id)
        REFERENCES RIDE_OFFER(ride_offer_id),
    CHECK (end_time IS NULL OR start_time IS NULL
           OR end_time >= start_time),
    CHECK (total_distance_km IS NULL OR total_distance_km >= 0)
);

CREATE TABLE BOOKING (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL UNIQUE,
    trip_id INT NOT NULL,
    seats_booked INT NOT NULL,
    status ENUM('CONFIRMED', 'CANCELLED', 'COMPLETED')
        NOT NULL DEFAULT 'CONFIRMED',
    booked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES `MATCH`(match_id),
    FOREIGN KEY (trip_id) REFERENCES TRIP(trip_id),
    CHECK (seats_booked > 0)
);

CREATE TABLE PAYMENT (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    paid_by INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_status ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED')
        NOT NULL DEFAULT 'PENDING',
    paid_at DATETIME,
    FOREIGN KEY (booking_id) REFERENCES BOOKING(booking_id),
    FOREIGN KEY (paid_by) REFERENCES `USER`(user_id),
    CHECK (amount >= 0)
);

CREATE TABLE CANCELLATION (
    cancellation_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL UNIQUE,
    cancelled_by INT NOT NULL,
    cancelled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(255),
    penalty_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    FOREIGN KEY (booking_id) REFERENCES BOOKING(booking_id),
    FOREIGN KEY (cancelled_by) REFERENCES `USER`(user_id),
    CHECK (penalty_amount >= 0)
);

CREATE TABLE RATING (
    rating_id INT AUTO_INCREMENT PRIMARY KEY,
    trip_id INT NOT NULL,
    rated_by INT NOT NULL,
    rated_to INT NOT NULL,
    rating_value INT NOT NULL,
    review TEXT,
    rated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (trip_id, rated_by, rated_to),
    FOREIGN KEY (trip_id) REFERENCES TRIP(trip_id),
    FOREIGN KEY (rated_by) REFERENCES `USER`(user_id),
    FOREIGN KEY (rated_to) REFERENCES `USER`(user_id),
    CHECK (rating_value BETWEEN 1 AND 5),
    CHECK (rated_by <> rated_to)
);
