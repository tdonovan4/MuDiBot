PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;


ALTER TABLE user ADD bio TEXT;


ALTER TABLE user ADD birthday TEXT;


ALTER TABLE user ADD location TEXT;


COMMIT;

PRAGMA foreign_keys=ON;
