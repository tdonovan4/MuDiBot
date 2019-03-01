PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;


ALTER TABLE custom_command RENAME TO temp_custom_command;


CREATE TABLE custom_command(
  server_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  name TEXT NOT NULL,
  arg TEXT NOT NULL
);


INSERT INTO custom_command
SELECT server_id,
       author_id,
       name,
       arg
FROM temp_custom_command;


DROP TABLE temp_custom_command;


COMMIT;

PRAGMA foreign_keys=ON;
