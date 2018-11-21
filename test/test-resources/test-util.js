const fs = require('fs');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);

module.exports = {
  deleteDatabase: async function(dbFolder) {
    var filesToDelete = await readdir(dbFolder);
    filesToDelete.forEach(async file => {
      await unlink(dbFolder + file);
    });
  }
}
