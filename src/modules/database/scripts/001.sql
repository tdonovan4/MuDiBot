PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;


CREATE TABLE IF NOT EXISTS database_settings(
  version INTEGER NOT NULL,
  date DATETIME NOT NULL);

ALTER TABLE users RENAME TO temp_users;


CREATE TABLE users(
  serverID TEXT,
  userId TEXT,
  xp INTEGER DEFAULT 0,
  warnings INTEGER DEFAULT 0,
  groups TEXT DEFAULT "$[default_group]",
  CONSTRAINT users_unique UNIQUE (serverID,
  userID));


DELETE
FROM temp_users
WHERE rowid NOT IN
    (SELECT min(rowid)
     FROM temp_users
     GROUP BY userId, serverId
     ORDER BY xp);


INSERT INTO users
SELECT *
FROM temp_users;


DROP TABLE temp_users;


COMMIT;

PRAGMA foreign_keys=ON;
