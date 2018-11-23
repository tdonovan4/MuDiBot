const fs = require('fs');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

module.exports = {
  deleteDatabase: async function(dbFolder) {
    var filesToDelete = await readdir(dbFolder);
    filesToDelete.forEach(async file => {
      await unlink(dbFolder + file);
    });
  },
  replaceDatabase: async function(dbFolder, newDB) {
    //Copy and paste the test database
    var dbFile = await readFile(`./test/test-resources/test-database/${newDB}`);
    await writeFile(dbFolder, dbFile);
  }
}
