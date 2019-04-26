PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;


CREATE TABLE bot_global(
  last_birthday_check TEXT
);


COMMIT;

PRAGMA foreign_keys=ON;
