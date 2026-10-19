USE carpooling_system;

DELIMITER $$

DROP TRIGGER IF EXISTS validate_booking_before_insert$$
DROP TRIGGER IF EXISTS validate_booking_passenger_before_insert$$
DROP TRIGGER IF EXISTS update_rating_after_insert$$
DROP TRIGGER IF EXISTS update_rating_after_update$$
DROP TRIGGER IF EXISTS update_rating_after_delete$$
DROP PROCEDURE IF EXISTS create_booking$$


-- Validate that the booking's match exists.
CREATE TRIGGER validate_booking_before_insert
BEFORE INSERT ON BOOKING
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM `MATCH`
        WHERE match_id = NEW.match_id
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Invalid match ID';
    END IF;
END$$


-- Validate that the booking's trip exists.
CREATE TRIGGER validate_booking_passenger_before_insert
BEFORE INSERT ON BOOKING
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM TRIP
        WHERE trip_id = NEW.trip_id
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Invalid trip ID';
    END IF;
END$$


-- Update the user's average rating after a rating is added.
CREATE TRIGGER update_rating_after_insert
AFTER INSERT ON RATING
FOR EACH ROW
BEGIN
    UPDATE `USER`
    SET rating_avg = (
        SELECT AVG(rating_value)
        FROM RATING
        WHERE rated_to = NEW.rated_to
    )
    WHERE user_id = NEW.rated_to;
END$$


-- Update rating averages after a rating is changed.
CREATE TRIGGER update_rating_after_update
AFTER UPDATE ON RATING
FOR EACH ROW
BEGIN
    UPDATE `USER`
    SET rating_avg = (
        SELECT AVG(rating_value)
        FROM RATING
        WHERE rated_to = OLD.rated_to
    )
    WHERE user_id = OLD.rated_to;

    UPDATE `USER`
    SET rating_avg = (
        SELECT AVG(rating_value)
        FROM RATING
        WHERE rated_to = NEW.rated_to
    )
    WHERE user_id = NEW.rated_to;
END$$


-- Update the user's average rating after a rating is deleted.
CREATE TRIGGER update_rating_after_delete
AFTER DELETE ON RATING
FOR EACH ROW
BEGIN
    UPDATE `USER`
    SET rating_avg = (
        SELECT AVG(rating_value)
        FROM RATING
        WHERE rated_to = OLD.rated_to
    )
    WHERE user_id = OLD.rated_to;
END$$


-- Create a booking and update available seats transactionally.
CREATE PROCEDURE create_booking(
    IN p_match_id INT,
    IN p_trip_id INT,
    IN p_seats_booked INT
)
BEGIN
    DECLARE v_offer_id INT;
    DECLARE v_available_seats INT;
    DECLARE v_booking_id INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    IF p_seats_booked <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Seats booked must be greater than zero';
    END IF;

    SELECT ride_offer_id
    INTO v_offer_id
    FROM `MATCH`
    WHERE match_id = p_match_id;

    IF NOT EXISTS (
        SELECT 1
        FROM TRIP
        WHERE trip_id = p_trip_id
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Trip does not exist';
    END IF;

    SELECT available_seats
    INTO v_available_seats
    FROM RIDE_OFFER
    WHERE ride_offer_id = v_offer_id
    FOR UPDATE;

    IF v_available_seats < p_seats_booked THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Not enough available seats';
    END IF;

    INSERT INTO BOOKING (
        match_id,
        trip_id,
        seats_booked,
        status,
        booked_at
    )
    VALUES (
        p_match_id,
        p_trip_id,
        p_seats_booked,
        'CONFIRMED',
        CURRENT_TIMESTAMP
    );

    SET v_booking_id = LAST_INSERT_ID();

    UPDATE RIDE_OFFER
    SET available_seats = available_seats - p_seats_booked,
        status = CASE
            WHEN available_seats - p_seats_booked = 0 THEN 'FULL'
            ELSE status
        END
    WHERE ride_offer_id = v_offer_id;

    COMMIT;

    SELECT v_booking_id AS booking_id;
END$$

DELIMITER ;