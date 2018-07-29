PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;


UPDATE user
SET permission_group = "$[default_group]"
WHERE permission_group IS NULL;


UPDATE user
SET bio = "$[default_bio]"
WHERE bio IS NULL;


UPDATE user
SET birthday = "$[default_birthday]"
WHERE birthday IS NULL;


UPDATE user
SET location = "$[default_location]"
WHERE location IS NULL;


ALTER TABLE user RENAME TO temp_user;


CREATE TABLE user (
	server_id	TEXT,
	user_id	TEXT,
	xp INTEGER DEFAULT 0,
	warning	INTEGER DEFAULT 0,
	permission_group TEXT DEFAULT "$[default_group]",
	bio	TEXT DEFAULT "$[default_bio]",
	birthday TEXT DEFAULT "$[default_birthday]",
	location TEXT DEFAULT "$[default_location]",
	CONSTRAINT users_unique UNIQUE(server_id, user_id)
);


INSERT INTO user
SELECT *
FROM temp_user;


DROP TABLE temp_user;


COMMIT;

PRAGMA foreign_keys=ON;
