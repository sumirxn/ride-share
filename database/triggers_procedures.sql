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
        SELECT COALESCE(ROUND(AVG(rating_value), 2), 0.00)
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
        SELECT COALESCE(ROUND(AVG(rating_value), 2), 0.00)
        FROM RATING
        WHERE rated_to = OLD.rated_to
    )
    WHERE user_id = OLD.rated_to;

    UPDATE `USER`
    SET rating_avg = (
        SELECT COALESCE(ROUND(AVG(rating_value), 2), 0.00)
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
        SELECT COALESCE(ROUND(AVG(rating_value), 2), 0.00)
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
    DECLARE v_request_id INT;
    DECLARE v_available_seats INT;
    DECLARE v_offer_status VARCHAR(20);
    DECLARE v_request_status VARCHAR(20);
    DECLARE v_trip_offer_id INT;
    DECLARE v_booking_id INT;
    DECLARE v_found BOOLEAN DEFAULT TRUE;
    DECLARE v_required_seats INT;

    DECLARE CONTINUE HANDLER FOR NOT FOUND
        SET v_found = FALSE;

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

    SET v_found = TRUE;

    SELECT ride_offer_id, ride_request_id
    INTO v_offer_id, v_request_id
    FROM `MATCH`
    WHERE match_id = p_match_id;

    IF v_found = FALSE THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Match not found';
    END IF;

    SET v_found = TRUE;

    SELECT ride_offer_id
    INTO v_trip_offer_id
    FROM TRIP
    WHERE trip_id = p_trip_id;

    IF v_found = FALSE THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Trip not found';
    END IF;

    IF v_trip_offer_id <> v_offer_id THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Trip does not belong to matched ride offer';
    END IF;

    SET v_found = TRUE;

    SELECT available_seats, status
    INTO v_available_seats, v_offer_status
    FROM RIDE_OFFER
    WHERE ride_offer_id = v_offer_id
    FOR UPDATE;

    IF v_found = FALSE THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Ride offer not found';
    END IF;

    IF v_offer_status <> 'OPEN' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Ride offer is not open';
    END IF;

    IF p_seats_booked > v_available_seats THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Not enough available seats';
    END IF;

    SET v_found = TRUE;

    SELECT seats_required, status
    INTO v_required_seats, v_request_status
    FROM RIDE_REQUEST
    WHERE ride_request_id = v_request_id
    FOR UPDATE;

    IF v_found = FALSE THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Ride request not found';
    END IF;

    IF v_request_status NOT IN ('OPEN', 'MATCHED') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Ride request is not available for booking';
    END IF;

    IF p_seats_booked <> v_required_seats THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Seats booked must equal seats requested';
    END IF;

    INSERT INTO BOOKING (match_id, trip_id, seats_booked)
    VALUES (p_match_id, p_trip_id, p_seats_booked);

    SET v_booking_id = LAST_INSERT_ID();

    UPDATE RIDE_OFFER
    SET available_seats = available_seats - p_seats_booked,
        status = CASE
            WHEN available_seats - p_seats_booked = 0 THEN 'FULL'
            ELSE 'OPEN'
        END
    WHERE ride_offer_id = v_offer_id;

    UPDATE RIDE_REQUEST
    SET status = 'BOOKED'
    WHERE ride_request_id = v_request_id;

    COMMIT;

    SELECT v_booking_id AS booking_id;
END$$

DELIMITER ;