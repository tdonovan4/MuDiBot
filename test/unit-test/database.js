const expect = require('chai').expect;
const Discord = require('discord.js');
const lang = require('../../localization/en-US.json');
var config = require('../../src/util.js').getConfig()[1];
var testMessages = require('../test-resources/test-messages.js');
var msg = testMessages.msg1;

const sql = require('sqlite');
const db = require('../../src/modules/database/database.js');
const queries = require('../../src/modules/database/queries.js');
const dbFolder = './test/database/';
const { deleteDatabase, replaceDatabase } = require('../test-resources/test-util.js');

const fs = require('fs');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);

//Setting channels
Discord.client.channels.set('1', {
  position: 0,
  name: '1',
  guild: {
    id: msg.guild.id
  },
  id: '1',
  type: 'text'
});
Discord.client.channels.set('2', {
  position: 1,
  name: 'general',
  guild: {
    id: '1234567890'
  },
  id: '2',
  type: 'text'
});
Discord.client.channels.set('3', {
  position: 1,
  name: 'test',
  guild: {
    id: '1234567890'
  },
  id: '3',
  type: 'text'
});

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
  //Copy and paste the test database
  var dbFile = await readFile(
    `./test/test-resources/test-database/legacy-v${version}-database.db`);
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
var { spyLog } = require('../test-resources/test-util.js');

//Comparaison database
var lastVersionSchema;

module.exports = function() {
  //Test database checker submodule
  afterEach(async function() {
    //Delete old database
    await deleteDatabase(dbFolder);
  });
  describe('Test database checker', function() {
    before(async function() {
      //Get last version database schema
      lastVersionSchema = await createDatabaseSchema(
        './test/test-resources/test-database/last-version-database.db');
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
    });
    it('Should update v002 to last version', async function() {
      await checkDatabaseUpdating('002');
    });
    it('Should update v003 to last version', async function() {
      await checkDatabaseUpdating('003');
    });
    it('Should update v004 to last version', async function() {
      await checkDatabaseUpdating('004');
    });
    it('Should update v005 to last version', async function() {
      await checkDatabaseUpdating('005');
    });
  });

  //Test queries submodule
  describe('Test queries', function() {
    beforeEach(async function() {
      await replaceDatabase(config.pathDatabase, 'data1.db');
    });
    describe('Test the get query', function() {
      it('Should get user based on server and user id', async function() {
        var query = 'SELECT server_id, user_id FROM user WHERE server_id = ? AND user_id = ?';
        var response = await queries.runGetQuery(query, ['1', '4']);
        expect(response.server_id).to.equal('1');
        expect(response.user_id).to.equal('4');
      });
      it('Should get the first user in the server with id 1', async function() {
        var query = 'SELECT server_id, user_id FROM user WHERE server_id = ?';
        var response = await queries.runGetQuery(query, ['1']);
        //Get only return a single response
        expect(response.server_id).to.equal('1');
        expect(response.user_id).to.equal('2');
      });
    });
    describe('Test the run query', function() {
      it('Should insert a table', async function() {
        //Execute
        var query = 'CREATE TABLE test(test1 TEXT, test2 INTEGER)';
        await queries.runQuery(query);
        //Verify
        var getQuery = 'SELECT name FROM sqlite_master WHERE type = "table" AND name = ?';
        var response = await queries.runGetQuery(getQuery, ['test']);
        expect(response.name).to.equal('test');
      });
    });
    describe('Test the all query', function() {
      it('Should get user based on server and user id', async function() {
        var query = 'SELECT server_id, user_id FROM user WHERE server_id = ? AND user_id = ?';
        var response = await queries.runAllQuery(query, ['1', '4']);
        expect(response[0].server_id).to.equal('1');
        expect(response[0].user_id).to.equal('4');
      });
      it('Should get users in the server with id 1', async function() {
        var query = 'SELECT * FROM user WHERE server_id = ?';
        var response = await queries.runAllQuery(query, ['1']);
        //All return an array
        expect(response.length).to.equal(3);
      });
    });
    describe('Test the insert and update query', function() {
      it('Should insert a new user', async function() {
        //Execute
        var insertQuery = 'INSERT OR IGNORE INTO user (server_id, user_id) VALUES (?, ?)'
        var updateQuery = 'UPDATE user SET warning = ? WHERE server_id = ? AND user_id = ?';
        await queries.runInsertUpdateQuery(insertQuery, updateQuery, ['1', '5']);
        //Verify
        var getQuery = 'SELECT warning FROM user WHERE server_id = ? AND user_id = ?';
        var response = await queries.runGetQuery(getQuery, ['1', '5']);
        expect(response.warning).to.equal(0);
      });
      it('Should update the user', async function() {
        //Execute
        var insertQuery = 'INSERT OR IGNORE INTO user (server_id, user_id) VALUES (?, ?)'
        var updateQuery = 'UPDATE user SET warning = ? WHERE server_id = ? AND user_id = ?';
        await queries.runInsertUpdateQuery(insertQuery, updateQuery, ['1', '5'], [5]);
        //Verify
        var getQuery = 'SELECT warning FROM user WHERE server_id = ? AND user_id = ?';
        var response = await queries.runGetQuery(getQuery, ['1', '5']);
        expect(response.warning).to.equal(5);
      });
    });
    describe('Test the update query', function() {
      it('Should update all occurences of user', async function() {
        //Execute
        var query = 'UPDATE user SET permission_group = ? WHERE user_id = ?';
        await queries.runUpdateQuery(query, '3', 'Mod');
        //Verify
        var getQuery = 'SELECT permission_group FROM user WHERE user_id = ?';
        var response = await queries.runAllQuery(getQuery, ['3']);
        /*eslint-disable camelcase*/
        expect(response).to.deep.equal([
          { permission_group: 'Mod' },
          { permission_group: 'Mod' },
        ]);
        /*eslint-enable camelcase*/
      });
    });
  });

  //Test user database submodule
  describe('Test users-db', function() {
    beforeEach(async function() {
      //Load empty database
      await replaceDatabase(config.pathDatabase, 'empty.db');
    });
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
      it('getPermGroups() should return default role', async function() {
        var response = await db.user.getPermGroups('1', '2');
        expect(response).to.equal(config.groups[0].name);
      });
      it('getHighestPermGroup() should return default role', async function() {
        var response = await db.user.getHighestPermGroup('1', '2');
        expect(response.name).to.equal(config.groups[0].name);
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
      it('getUsersByBirthday() should return empty array', async function() {
        var response = await db.user.getUsersByBirthday('02-19');
        expect(response).to.be.empty;
      });
      it('getGlobalBirthdayCount should return 0', async function() {
        var response = await db.user.getGlobalBirthdayCount();
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
    });
    describe('Test update queries with empty database', function() {
      beforeEach(async function() {
        //Load empty database
        await replaceDatabase(config.pathDatabase, 'empty.db');
      });
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
    });
    describe('Test user count', function() {
      beforeEach(async function() {
        //Load database
        await replaceDatabase(config.pathDatabase, 'data1.db');
      });
      it('getLocalCount should return 1', async function() {
        var response = await db.user.getLocalCount('2');
        expect(response).to.equal(1);
      });
      it('getGlobalCount should return 4', async function() {
        var response = await db.user.getGlobalCount();
        expect(response).to.equal(4);
      });
      it('getGlobalBirthdayCount should return 3', async function() {
        var response = await db.user.getGlobalBirthdayCount();
        expect(response).to.equal(3);
      });
    });
    describe('Test updating existing users', function() {
      beforeEach(async function() {
        await replaceDatabase(config.pathDatabase, 'data1.db');
      });
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
      it('getUsersByBirthday() should return users with a birthday the 25 March', async function() {
        var response = await db.user.getUsersByBirthday('03-25');
        expect(response[0].server_id).to.equal('3');
        expect(response[0].user_id).to.equal('3');
        expect(response[1].server_id).to.equal('2');
        expect(response[1].user_id).to.equal('1');
      });
      it('getHighestPermGroup() should return Mod', async function() {
        var response = await db.user.getHighestPermGroup('2', '1');
        expect(response.name).to.equal('Mod');
      });
      it('getSumXP should merge same user XP', async function() {
        //Add user in another server
        await db.user.updateXP('3', '3', 10000);
        var response = await db.user.getSumXP('3');
        expect(response).to.equal(20000);
      })
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

  //Test config database submodule
  describe('Test config-db', function() {
    describe('Test getDefaultChannel with empty responses', function() {
      beforeEach(async function() {
        await replaceDatabase(config.pathDatabase, 'empty.db');
      });
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
      describe('Empty', function() {
        before(async function() {
          await replaceDatabase(config.pathDatabase, 'empty.db');
        });
        it('Should insert channel into empty table', async function() {
          await db.config.updateDefaultChannel('1234567890', { id: '3' });
          var response = await db.config.getDefaultChannel('1234567890');
          expect(response.name).to.equal('test');
        });
      });
      describe('With existing values', function() {
        before(async function() {
          await replaceDatabase(config.pathDatabase, 'data1.db');
        });
        it('Should modify existing row', async function() {
          await db.config.updateDefaultChannel('1234567890', { id: '2' });
          var response = await db.config.getDefaultChannel('1234567890');
          expect(response.name).to.equal('general');
        });
      });
    });
  });

  //Test reward database submodule
  describe('Test rewards-db.js', function() {
    describe('Test getRankReward with empty response', function() {
      beforeEach(async function() {
        await replaceDatabase(config.pathDatabase, 'empty.db');
      });
      it('Should return undefined if rank doesn\'t have a reward', async function() {
        var response = await db.reward.getRankReward(msg.guild.id, 'random');
        expect(response).to.equal(undefined);
      });
    });
    describe('Test updateRankReward', function() {
      describe('Test in empty database', function() {
        beforeEach(async function() {
          await replaceDatabase(config.pathDatabase, 'empty.db');
        });
        it('Should add reward to rank', async function() {
          await db.reward.updateRankReward(msg.guild.id, 'King', 'Member');
          var response = await db.reward.getRankReward(msg.guild.id, 'King');
          expect(response).to.equal('Member');
        });
      });
      describe('Test in populated database', function() {
        beforeEach(async function() {
          await replaceDatabase(config.pathDatabase, 'data1.db');
        });
        it('Should update the reward', async function() {
          await db.reward.updateRankReward(msg.guild.id, 'Farmer', 'Mod');
          var response = await db.reward.getRankReward(msg.guild.id, 'Farmer');
          expect(response).to.equal('Mod');
        });
      });
    });
    describe('Test deleteRankReward', function() {
      beforeEach(async function() {
        await replaceDatabase(config.pathDatabase, 'empty.db');
      });
      it('Should delete reward', async function() {
        await db.reward.deleteRankReward(msg.guild.id, 'Farmer');
        var response = await db.reward.getRankReward(msg.guild.id, 'Farmer');
        expect(response).to.equal(undefined);
      });
    });
  });

  //Test custom command database submodule
  describe('Test custom-cmd-db.js', function() {
    describe('Test get queries with empty responses', function() {
      beforeEach(async function() {
        await replaceDatabase(config.pathDatabase, 'empty.db');
      });
      it('getGlobalCount should return 0', async function() {
        var response = await db.customCmd.getGlobalCount();
        expect(response).to.equal(0);
      });
      it('getCmd should return undefined', async function() {
        var response = await db.customCmd.getCmd(msg.guild.id, 'test');
        expect(response).to.equal(undefined);
      });
      it('getCmds should return empty array', async function() {
        var response = await db.customCmd.getCmds(msg.guild.id);
        expect(response.length).to.equal(0);
      });
      it('getUserCmds should return empty array', async function() {
        var response = await db.customCmd.getUserCmds(msg.guild.id, msg.author.id);
        expect(response.length).to.equal(0);
      });
    });
    describe('Test insertCmd', function() {
      describe('Test in empty database', function() {
        beforeEach(async function() {
          await replaceDatabase(config.pathDatabase, 'empty.db');
        });
        it('Should insert new cmd', async function() {
          await db.customCmd.insertCmd(msg.guild.id, msg.author.id, 'test1', 'test1');
          var cmd = await db.customCmd.getCmd(msg.guild.id, 'test1');
          var cmds = await db.customCmd.getCmds(msg.guild.id);
          expect(cmd.arg).to.equal('test1');
          expect(cmds.length).to.equal(1);
        });
      });
      describe('Test in populated database', function() {
        beforeEach(async function() {
          await replaceDatabase(config.pathDatabase, 'data1.db');
        });
        it('getGlobalCount should return 3', async function() {
          var response = await db.customCmd.getGlobalCount();
          expect(response).to.equal(14);
        });
        it('Should insert another cmd', async function() {
          await db.customCmd.insertCmd(msg.guild.id, msg.author.id, 'test4', 'test4');
          var cmd = await db.customCmd.getCmd(msg.guild.id, 'test4');
          var cmds = await db.customCmd.getCmds(msg.guild.id);
          expect(cmd.arg).to.equal('test4');
          expect(cmds.length).to.equal(4);
        });
        before(async function() {
          await replaceDatabase(config.pathDatabase, 'data1.db');
        });
        it('Should insert cmd in another guild', async function() {
          await db.customCmd.insertCmd('1', msg.author.id, 'test1', 'test1');
          var cmd = await db.customCmd.getCmd('1', 'test1');
          var cmds = await db.customCmd.getCmds('1');
          expect(cmd.arg).to.equal('test1');
          expect(cmds.length).to.equal(1);
        });
        it('getUserCmds should return commands by TestUser', async function() {
          var response = await db.customCmd.getUserCmds(msg.guild.id, msg.author.id);
          expect(response[0].name).to.equal('test1');
          expect(response[1].name).to.equal('test2');
          expect(response.length).to.equal(2);
        });
      });
    });
    describe('Test deleteCmd', function() {
      beforeEach(async function() {
        await replaceDatabase(config.pathDatabase, 'data1.db');
      });
      it('Should delete cmd', async function() {
        await db.customCmd.deleteCmd(msg.guild.id, 'test1');
        var cmd = await db.customCmd.getCmd(msg.guild.id, 'test1');
        var cmds = await db.customCmd.getCmds(msg.guild.id);
        expect(cmd).to.equal(undefined);
        expect(cmds.length).to.equal(2);
      });
    })
  });

  //Test leaderboard submodule
  describe('Test leaderboard.js', function() {
    beforeEach(async function() {
      await replaceDatabase(config.pathDatabase, 'data2.db');
    });
    describe('Test tops', function() {
      it('getLocalTop should return the correct leaderboard', async function() {
        var response = await db.leaderboard.getLocalTop('1', 10);
        /*eslint-disable camelcase*/
        expect(response).to.deep.equal([{
          user_id: '3',
          xp: 15000
        }, {
          user_id: '2',
          xp: 150
        }, {
          user_id: '4',
          xp: 0
        }]);
      });
      it('getGlobalTop should return the correct leaderboard', async function() {
        var response = await db.leaderboard.getGlobalTop(10);
        expect(response).to.deep.equal([{
          user_id: '3',
          xp: 25000
        }, {
          user_id: '1',
          xp: 15000
        }, {
          user_id: '2',
          xp: 400
        }, {
          user_id: '4',
          xp: 0
        }]);
        /*eslint-enable camelcase*/
      });
    });
    describe('Test positions', function() {
      it('getUserLocalPos should return 2', async function() {
        var response = await db.leaderboard.getUserLocalPos('1', '2');
        expect(response).to.equal(2);
      });
      it('getUserGlobalPos should return 3', async function() {
        var response = await db.leaderboard.getUserGlobalPos('2');
        expect(response).to.equal(3);
      });
    });
  });

  //Test the bot global submodule
  describe('Test bot-global.js', function() {
    describe('Test in empty database', function() {
      beforeEach(async function() {
        await replaceDatabase(config.pathDatabase, 'empty.db');
      });
      it('getLastBirthdayCheck should return undefined', async function() {
        var response = await db.botGlobal.getLastBirthdayCheck();
        expect(response).to.be.undefined;
      });
      it('updateLastBirthdayCheck should update date to 2019-04-28 12:00:00', async function() {
        await db.botGlobal.updateLastBirthdayCheck('2019-04-28 12:00:00');
        var response = await db.botGlobal.getLastBirthdayCheck();
        expect(response).to.equal('2019-04-28 12:00:00');
      });
    });
    describe('Test in populated database', function() {
      beforeEach(async function() {
        await replaceDatabase(config.pathDatabase, 'data1.db');
      });
      it('getLastBirthdayCheck should return 2019-04-26 12:00:00', async function() {
        var response = await db.botGlobal.getLastBirthdayCheck();
        expect(response).to.equal('2019-04-26 12:00:00');
      });
      it('updateLastBirthdayCheck should update existing date to 2019-04-28 12:00:00', async function() {
        await db.botGlobal.updateLastBirthdayCheck('2019-04-28 12:00:00');
        var response = await db.botGlobal.getLastBirthdayCheck();
        expect(response).to.equal('2019-04-28 12:00:00');
      });
    });
  });

  after(async function() {
    //Load empty database for the rest of the test
    await replaceDatabase(config.pathDatabase, 'empty.db');
  });
}
