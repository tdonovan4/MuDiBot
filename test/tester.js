const Discord = require('discord.js');
const fs = require('fs');
const testUtil = require('./test-resources/test-util.js');

//Add test values to config
require('./set-config.js').setTestConfig();
var config = require('../src/util.js').getConfig()[1];

//Set some stubs and spies
Discord.client = require('./test-resources/test-client.js');
var { printMsg } = testUtil;
printMsg.returnsArg(1);

//Init commands
const commands = require('../src/commands.js');

//Register stuff
commands.registerCategories(config.categories);
commands.registerCommands();

//Checking for database folder
const dbFolder = './test/database/';
if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder);
}

//Test the database module
const dbTest = require('./unit-test/database.js');
describe('Test the database module', function() {
  dbTest();
});

//Test the commands module
const commandsTest = require('./unit-test/commands.js');
describe('Test the commands module', function() {
  commandsTest();
});

//Test the administration module
const administrationTest = require('./unit-test/administration.js');
describe('Test the administration module', function() {
  administrationTest();
});

//Test the fun module
const funTest = require('./unit-test/fun.js');
describe('Test the fun module', function() {
  funTest();
});

//Test the general module
const generalTest = require('./unit-test/general.js');
describe('Test the general module', function() {
  generalTest();
});

//Test the music module
const musicTest = require('./unit-test/music.js');
describe('Test the music module', function() {
  musicTest();
});

//Test the user module
const userTest = require('./unit-test/user.js');
describe('Test the user module', function() {
  userTest();
});

//Test the warnings module
const warningsTest = require('./unit-test/warnings.js');
describe('Test the warnings module', function() {
  warningsTest();
});

//Test the levels module
const levelsTest = require('./unit-test/levels.js');
describe('Test the levels module', function() {
  levelsTest();
});

after(async function() {
  //Make sure to delete the database at the end
  await testUtil.deleteDatabase(dbFolder);
});
