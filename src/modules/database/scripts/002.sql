PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;


CREATE TABLE custom_command(
  server_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  name TEXT NOT NULL,
  action TEXT NOT NULL,
  arg TEXT NOT NULL);


INSERT INTO custom_command
SELECT *
FROM customCmds;


DROP TABLE customCmds;


CREATE TABLE reward(
  server_id TEXT,
  required_rank TEXT,
  reward TEXT);


INSERT INTO reward
SELECT *
FROM rewards;


DROP TABLE rewards;


CREATE TABLE config(
  server_id TEXT,
  default_channel TEXT);


INSERT INTO config
SELECT *
FROM servers;


DROP TABLE servers;


CREATE TABLE user(
  server_id TEXT,
  user_id TEXT,
  xp INTEGER DEFAULT 0,
  warning INTEGER DEFAULT 0,
  permission_group TEXT DEFAULT "$[default_group]",
  CONSTRAINT users_unique UNIQUE (server_id,
  user_id));


INSERT INTO user
SELECT *
FROM users;


DROP TABLE users;


COMMIT;

PRAGMA foreign_keys=ON;
