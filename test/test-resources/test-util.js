const fs = require('fs');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

var testMessages = require('../test-resources/test-messages.js');
var msg = testMessages.msg1;
const util = require('../../src/util.js')
const sinon = require('sinon');

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
  },
  printMsg: sinon.stub(util, 'printMsg'),
  msgSend: sinon.spy(msg.channel, 'send'),
  spyLog: sinon.spy(console, 'log'),
  reply: sinon.spy(msg, 'reply')
}
