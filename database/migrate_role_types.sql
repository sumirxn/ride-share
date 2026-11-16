USE carpooling_system;

-- Keep the legacy value available while existing USER accounts are classified.
ALTER TABLE `USER`
    MODIFY role ENUM('USER', 'PASSENGER', 'DRIVER', 'ADMIN')
    NOT NULL DEFAULT 'PASSENGER';

UPDATE `USER` u
SET role = 'DRIVER'
WHERE role = 'USER'
  AND (
      EXISTS (SELECT 1 FROM VEHICLE v WHERE v.owner_id = u.user_id)
      OR EXISTS (SELECT 1 FROM RIDE_OFFER ro WHERE ro.user_id = u.user_id)
  );

UPDATE `USER`
SET role = 'PASSENGER'
WHERE role = 'USER';

ALTER TABLE `USER`
    MODIFY role ENUM('PASSENGER', 'DRIVER', 'ADMIN')
    NOT NULL DEFAULT 'PASSENGER';
