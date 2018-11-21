const expect = require('chai').expect;
const sinon = require('sinon');
const lang = require('../../localization/en-US.json');
var config = require('../../src/util.js').getConfig()[1];
var testMessages = require('../test-resources/test-messages.js');
var msg = testMessages.msg1;

const sql = require('sqlite');
const db = require('../../src/modules/database/database.js');
const dbFolder = './test/database/';
const { deleteDatabase } = require('../test-resources/test-util.js');

const fs = require('fs');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);

async function createDatabaseSchema(path) {
  await sql.open(path);
  var schema = [];
  var tables = await sql.all('SELECT * FROM sqlite_master WHERE type="table"');
  //Create schema for each tables
  for (var table of tables) {
    //Name
    var tableObj = {
      name: table.name
    };
    //Schema
    tableObj.schema = await sql.all(`PRAGMA table_info(${table.name})`);
    //Rows (except database_settings because it contains dates)
    if (table.name != 'database_settings') {
      tableObj.rows = await sql.all(`SELECT * FROM ${table.name}`);
    } else {
      //Get only the row count
      tableObj.rows = await sql.get(`SELECT count(*) FROM ${table.name}`);
    }
    schema.push(tableObj);
  }
  await sql.close();
  return schema
}

async function checkDatabaseUpdating(version) {
  //Delete old database
  await deleteDatabase(dbFolder);
  //Copy and paste the test database
  var dbFile = await readFile(`./test/test-resources/legacy-v${version}-database.db`);
  await writeFile(config.pathDatabase, dbFile);
  //Update database
  await db.checker.check();
  //Check backup
  var backup = dbFolder + `database-backup-v${version}.db`;
  expect(await stat(backup)).to.be.an('object');
  var schema = await createDatabaseSchema(config.pathDatabase);
  expect(schema).to.deep.equal(lastVersionSchema);
}

//Make console.log a spy
var spyLog = sinon.spy(console, 'log');

//Comparaison database
var lastVersionSchema;

module.exports = function() {
  describe('Test database checker', function() {
    before(async function() {
      //Get last version database schema
      lastVersionSchema = await createDatabaseSchema('./test/test-resources/last-version-database.db');
      //Setup
      await db.checker.check();
    });
    it('Should not attempt to create an existing table', async function() {
      //If there is an attempt there will be an error
      await db.checker.check();
      expect(spyLog.lastCall.args[0]).to.equal(lang.database.clear);
    });
    it('Should update baseline to last version', async function() {
      await checkDatabaseUpdating('000');
    });
    it('Should update v001 to last version', async function() {
      await checkDatabaseUpdating('001');
    })
    it('Should update v002 to last version', async function() {
      await checkDatabaseUpdating('002');
    })
    it('Should update v003 to last version', async function() {
      await checkDatabaseUpdating('003');
    })
    it('Should make a fresh new database for rest of tests', async function() {
      //Delete old database
      await deleteDatabase(dbFolder);
      //Create tables
      await db.checker.check();
    });
  });

  describe('Test users-db', function() {
    describe('Test get queries with empty responses', function() {
      it('getLocalCount should return 0', async function() {
        var response = await db.user.getLocalCount('1');
        expect(response).to.equal(0);
      });
      it('getGlobalCount should return 0', async function() {
        var response = await db.user.getGlobalCount();
        expect(response).to.equal(0);
      });
      it('getAll() should return undefined', async function() {
        var response = await db.user.getAll('1', '2');
        expect(response).to.equal(undefined);
      });
      it('getXP() should return 0', async function() {
        var response = await db.user.getXP('1', '2');
        expect(response).to.equal(0);
      });
      it('getSumXP() should return 0', async function() {
        var response = await db.user.getSumXP('2');
        expect(response).to.equal(0);
      });
      it('getWarnings() should return 0', async function() {
        var response = await db.user.getWarnings('1', '2');
        expect(response).to.equal(0);
      });
      it('getUsersWarnings() should return empty array', async function() {
        var response = await db.user.getUsersWarnings('1');
        expect(response).to.be.empty;
      });
      it('exists() should return false', async function() {
        var response = await db.user.exists('1', '2');
        expect(response).to.equal(false);
      });
      //Last because it does an insert if response is null
      it('getPermGroups() should return default role', async function() {
        var response = await db.user.getPermGroups('1', '2');
        expect(response).to.equal(config.groups[0].name);
      });
    });
    describe('Test update queries with empty database', function() {
      it('updatePermGroups() should change group to Member', async function() {
        await db.user.updatePermGroups('1', '2', 'Member');
        var response = await db.user.getPermGroups('1', '2');
        expect(response).to.equal('Member');
      });
      it('updateXP() should change XP to 10000', async function() {
        await db.user.updateXP('1', '3', 10000);
        var response = await db.user.getXP('1', '3');
        expect(response).to.equal(10000);
      });
      it('updateWarnings() should change warnings to 4', async function() {
        await db.user.updateWarnings('1', '4', 4);
        var response = await db.user.getWarnings('1', '4');
        expect(response).to.equal(4);
      });
      it('updateBio() should change bio to lorem ipsum', async function() {
        await db.user.updateBio('1', '4', 'lorem ipsum');
        var response = await db.user.getAll('1', '4');
        expect(response.bio).to.equal('lorem ipsum');
      });
      it('updateBirthday() should change birthday to 1971-01-01', async function() {
        await db.user.updateBirthday('1', '4', '1971-01-01');
        var response = await db.user.getAll('1', '4');
        expect(response.birthday).to.equal('1971-01-01');
      });
      it('updateLocation() should change location to somewhere', async function() {
        await db.user.updateLocation('1', '4', 'somewhere');
        var response = await db.user.getAll('1', '4');
        expect(response.location).to.equal('somewhere');
      });
      it('updateUsersWarnings() should change warnings to 1', async function() {
        await db.user.updateUsersWarnings('1', 1);
        var response = await db.user.getUsersWarnings('1');
        expect(response).to.deep.equal([{
          "user_id": "2",
          "warning": 1
        }, {
          "user_id": "3",
          "warning": 1
        }, {
          "user_id": "4",
          "warning": 1
        }]);
      });
      it('getSumXP should merge same user XP', async function() {
        //Add user in another server
        await db.user.updateXP('3', '3', 10000);
        var response = await db.user.getSumXP('3');
        expect(response).to.equal(20000);
      })
    });
    describe('Test user count', function() {
      it('getLocalCount should return 1', async function() {
        //Add user in new server
        await db.user.updateXP('2', '1', 15000);
        var response = await db.user.getLocalCount('2');
        expect(response).to.equal(1);
      });
      it('getGlobalCount should return 4', async function() {
        var response = await db.user.getGlobalCount();
        expect(response).to.equal(4);
      });
    });
    describe('Test updating existing users', function() {
      it('updatePermGroups() should change group to Mod', async function() {
        await db.user.updatePermGroups('1', '2', 'Mod');
        var response = await db.user.getPermGroups('1', '2');
        expect(response).to.equal('Mod');
      });
      it('updateXP() should change XP to 15000', async function() {
        await db.user.updateXP('1', '3', 15000);
        var response = await db.user.getXP('1', '3');
        expect(response).to.equal(15000);
      });
      it('updateWarnings() should change warnings to 2', async function() {
        await db.user.updateWarnings('1', '4', 2);
        var response = await db.user.getWarnings('1', '4');
        expect(response).to.equal(2);
      });
      it('updateBio() should change bio to an other thing', async function() {
        await db.user.updateBio('1', '4', 'This is a bio');
        var response = await db.user.getAll('1', '4');
        expect(response.bio).to.equal('This is a bio');
      });
      it('updateBirthday() should change birthday to 2038-01-01', async function() {
        await db.user.updateBirthday('1', '4', '2038-01-01');
        var response = await db.user.getAll('1', '4');
        expect(response.birthday).to.equal('2038-01-01');
      });
      it('updateLocation() should change location to there', async function() {
        await db.user.updateLocation('1', '4', 'there');
        var response = await db.user.getAll('1', '4');
        expect(response.location).to.equal('there');
      });
      it('updateUsersWarnings() should change warnings to 0', async function() {
        await db.user.updateUsersWarnings('1', 0);
        var response = await db.user.getUsersWarnings('1');
        expect(response).to.deep.equal([{
          "user_id": "2",
          "warning": 0
        }, {
          "user_id": "3",
          "warning": 0
        }, {
          "user_id": "4",
          "warning": 0
        }]);
      });
    });
  });

  describe('Test config-db', function() {
    describe('Test getDefaultChannel with empty responses', function() {
      it('Should return first channel if no general', async function() {
        var response = await db.config.getDefaultChannel(msg.guild.id);
        expect(response.position).to.equal(0);
      });
      it('Should return general', async function() {
        var response = await db.config.getDefaultChannel('1234567890');
        expect(response.name).to.equal('general');
      })
    });
    describe('Test updateDefaultChannel', function() {
      it('Should insert channel into empty table', async function() {
        await db.config.updateDefaultChannel('1234567890', { id: '3' });
        var response = await db.config.getDefaultChannel('1234567890');
        expect(response.name).to.equal('test');
      })
      it('Should modify existing row', async function() {
        await db.config.updateDefaultChannel('1234567890', { id: '2' });
        var response = await db.config.getDefaultChannel('1234567890');
        expect(response.name).to.equal('general');
      })
    });
  });

  describe('Test rewards-db.js', function() {
    describe('Test getRankReward with empty response', function() {
      it('Should return undefined if rank doesn\'t have a reward', async function() {
        var response = await db.reward.getRankReward(msg.guild.id, 'random');
        expect(response).to.equal(undefined);
      });
    });
    describe('Test updateRankReward', function() {
      it('Should add reward to rank', async function() {
        await db.reward.updateRankReward(msg.guild.id, 'King', 'Member');
        var response = await db.reward.getRankReward(msg.guild.id, 'King');
        expect(response).to.equal('Member');
      });
      it('Should update the reward', async function() {
        await db.reward.updateRankReward(msg.guild.id, 'King', 'Mod');
        var response = await db.reward.getRankReward(msg.guild.id, 'King');
        expect(response).to.equal('Mod');
      });
    });
    describe('Test deleteRankReward', function() {
      it('Should delete reward', async function() {
        await db.reward.deleteRankReward(msg.guild.id, 'King');
        var response = await db.reward.getRankReward(msg.guild.id, 'King');
        expect(response).to.equal(undefined);
      });
    });
  });

  describe('Test custom-cmd-db.js', function() {
    describe('Test get queries with empty responses', function() {
      it('getCmd should return undefined', async function() {
        var response = await db.customCmd.getCmd(msg.guild.id, 'test');
        expect(response).to.equal(undefined);
      });
      it('getCmds should return empty array', async function() {
        var response = await db.customCmd.getCmds(msg.guild.id);
        expect(response.length).to.equal(0);
      });
    });
    describe('Test insertCmd', function() {
      it('Should insert new cmd', async function() {
        await db.customCmd.insertCmd(msg.guild.id, msg.author.id, 'test1', 'say', 'test1');
        var cmd = await db.customCmd.getCmd(msg.guild.id, 'test1');
        var cmds = await db.customCmd.getCmds(msg.guild.id);
        expect(cmd.arg).to.equal('test1');
        expect(cmds.length).to.equal(1);
      });
      it('Should insert another cmd', async function() {
        await db.customCmd.insertCmd(msg.guild.id, msg.author.id, 'test2', 'say', 'test2');
        var cmd = await db.customCmd.getCmd(msg.guild.id, 'test2');
        var cmds = await db.customCmd.getCmds(msg.guild.id);
        expect(cmd.arg).to.equal('test2');
        expect(cmds.length).to.equal(2);
      });
      it('Should insert cmd in another guild', async function() {
        await db.customCmd.insertCmd('1', msg.author.id, 'test1', 'say', 'test1');
        var cmd = await db.customCmd.getCmd('1', 'test1');
        var cmds = await db.customCmd.getCmds('1');
        expect(cmd.arg).to.equal('test1');
        expect(cmds.length).to.equal(1);
      })
    });
    describe('Test deleteCmd', function() {
      it('Should delete cmd', async function() {
        await db.customCmd.deleteCmd(msg.guild.id, 'test1');
        var cmd = await db.customCmd.getCmd(msg.guild.id, 'test1');
        var cmds = await db.customCmd.getCmds(msg.guild.id);
        expect(cmd).to.equal(undefined);
        expect(cmds.length).to.equal(1);
      });
    })
  });
}
