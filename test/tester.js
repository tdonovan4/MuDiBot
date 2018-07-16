/*eslint no-underscore-dangle: "off"*/
const expect = require('chai').expect;
const sinon = require('sinon');
const Discord = require('discord.js');
const lang = require('../localization/en-US.json');
const mustache = require('mustache');
const sql = require('sqlite');
const fs = require('fs');
const rewire = require('rewire');
const youtube = require('./test-resources/test-youtube.js');
var testMessages = rewire('./test-resources/test-messages.js');
var msg = testMessages.msg1;

//Add test values to config
require('./set-config.js').setTestConfig();
var config = require('../src/args.js').getConfig()[1];

//Set some stubs and spies
var client = sinon.stub(Discord, 'Client');
var testClient = require('./test-resources/test-client.js');
client.returns(testClient);
var msgSend = sinon.spy(msg.channel, 'send')
var reply = sinon.spy(msg, 'reply')
const giphy = rewire('../src/modules/fun/giphy-api.js');
giphy.__set__({
  search: function() {
    return 'A gif';
  },
  random: function() {
    return 'A random gif';
  }
})

const levels = rewire('../src/levels.js');
const permGroups = rewire('../src/modules/user/permission-group.js');
const warnings = require('../src/modules/warnings/warnings.js');

//Init bot
const bot = require('../src/bot.js');

//Init stuff that need bot
const db = require('../src/modules/database/database.js');
const audioPlayer = rewire('../src/modules/music/audio-player.js');
var setActivity = sinon.spy(bot.client().user, 'setActivity');
var channelSend = sinon.spy(bot.client().channels.get('42'), 'send');
var printMsg = sinon.stub(bot, 'printMsg');
printMsg.returnsArg(1);

//Init commands
const commands = require('../src/commands.js');

//Register stuff
commands.registerCategories(config.categories);
commands.registerCommands();

//Checking for database folder
var dbFolder = './test/database/';
if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder);
}

//Because promises are better than callbacks
const util = require('util');
const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const stat = util.promisify(fs.stat);
const unlink = util.promisify(fs.unlink);

async function deleteDatabase() {
  var filesToDelete = await readdir(dbFolder);
  filesToDelete.forEach(async file => {
    await unlink(dbFolder+file);
  });
}

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

//Comparaison database
var lastVersionSchema;

async function checkDatabaseUpdating(version) {
  //Delete old database
  await deleteDatabase();
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
    await deleteDatabase();
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
//Setting channels
testClient.channels.set('1', {
  position: 0,
  name: '1',
  guild: {
    id: msg.guild.id
  },
  id: '1',
  type: 'text'
});
testClient.channels.set('2', {
  position: 1,
  name: 'general',
  guild: {
    id: '1234567890'
  },
  id: '2',
  type: 'text'
});
testClient.channels.set('3', {
  position: 1,
  name: 'test',
  guild: {
    id: '1234567890'
  },
  id: '3',
  type: 'text'
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
      await db.config.updateDefaultChannel('1234567890', {
        id: '3'
      });
      var response = await db.config.getDefaultChannel('1234567890');
      expect(response.name).to.equal('test');
    })
    it('Should modify existing row', async function() {
      await db.config.updateDefaultChannel('1234567890', {
        id: '2'
      });
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
describe('Test leaderboard.js', function() {
  describe('Test tops', function() {
    before(async function() {
      //Spice things up
      await db.user.updateXP('1', '2', 150);
      await db.user.updateXP('2', '2', 250);
    })
    it('getLocalTop should return the correct leaderboard', async function() {
      var response = await db.leaderboard.getLocalTop('1', 10);
      /*eslint-disable camelcase*/
      expect(response).to.deep.equal([
        {
          user_id: '3', xp: 15000
        }, {
          user_id: '2', xp: 150
        }, {
          user_id: '4', xp: 0
      }]);
    });
    it('getGlobalTop should return the correct leaderboard', async function() {
      var response = await db.leaderboard.getGlobalTop(10);
      expect(response).to.deep.equal([
        {
          user_id: '3', xp: 25000
        }, {
          user_id: '1', xp: 15000
        }, {
          user_id: '2', xp: 400
        }, {
          user_id: '4', xp: 0
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
  })
});
describe('Test permission groups', function() {
  describe('Test setGroup', function() {
    it('Should return invalid user', function() {
      permGroups.setGroup(msg);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.invalidArg.user);
    });
    it('Should return missing argument: group', function() {
      permGroups.setGroup(msg, '041025599435591424');
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.missingArg.group);
    });
    it('Should return group not found', function() {
      permGroups.setGroup(msg, '041025599435591424', 'qwerty');
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.notFound.group);
    });
    it('Should add "User" to the list of groups of TestUser', async function() {
      await permGroups.setGroup(msg, msg.author, 'User');
      var response = await db.user.getPermGroups(msg.guild.id, '041025599435591424');
      expect(response).to.equal('User');
    });
    it('Should add "Member" to the list of groups of TestUser', async function() {
      await permGroups.setGroup(msg, msg.author, 'Member');
      var response = await db.user.getPermGroups(msg.guild.id, '041025599435591424');
      expect(response).to.equal('User,Member');
    });
  });
  describe('Test unsetGroup', function() {
    it('Should return invalid user', function() {
      permGroups.unsetGroup(msg);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.invalidArg.user);
    });
    it('Should return missing argument: group', function() {
      permGroups.unsetGroup(msg, '041025599435591424');
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.missingArg.group);
    });
    it('Should return group not found', function() {
      permGroups.unsetGroup(msg, '041025599435591424', 'qwerty');
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.notFound.group);
    });
    it('Should remove "User" from the list of groups of TestUser', async function() {
      await permGroups.unsetGroup(msg, msg.author, 'User');
      var response = await db.user.getPermGroups(msg.guild.id, '041025599435591424');
      expect(response).to.equal('Member');
    });
    it('Should return that the user is not in this group', async function() {
      await permGroups.unsetGroup(msg, msg.author, 'Admin');
      expect(printMsg.lastCall.returnValue).to.equal(lang.unsetgroup.notInGroup);
    })
  });
  describe('Test purgeGroups', function() {
    it('Should return invalid user', function() {
      permGroups.__get__('purgeGroups')(msg);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.invalidArg.user);
    });
    it('Should purge TestUser\'s groups', async function() {
      await permGroups.setGroup(msg, msg.author, 'User');
      msg.mentions.users.set('041025599435591424', {
        id: '041025599435591424'
      });
      await permGroups.__get__('purgeGroups')(msg);
      var response = await db.user.getPermGroups(msg.guild.id, '041025599435591424');
      expect(response).to.equal('User');
    })
  });
});
describe('Test levels', function() {
  describe('Test getXpForLevel', function() {
    it('Should return 100 XP for level 1', async function() {
      var response = await levels.getXpForLevel(1);
      expect(response).to.equal(100);
    });
    it('Should return 100 XP for level 15', async function() {
      var response = await levels.getXpForLevel(15);
      expect(response).to.equal(155);
    });
    it('Should return 100 XP for level 125', async function() {
      var response = await levels.getXpForLevel(125);
      expect(response).to.equal(1495);
    });
  });
  describe('Test getProgression', function() {
    it('Should returns the result of 115 XP', function() {
      var response = levels.getProgression(115);
      expect(response).to.deep.equal([2, 15, 2]);
    });
    it('Should returns the result of 420 XP', function() {
      var response = levels.getProgression(420);
      expect(response).to.deep.equal([5, 10, 5]);
    });
    it('Should returns the result of 123456 XP', function() {
      var response = levels.getProgression(123456);
      expect(response).to.deep.equal([72, 681, 272]);
    });
    it('Should returns the result of 3141592 XP', function() {
      var response = levels.getProgression(3141592);
      expect(response).to.deep.equal([0, 0, 1000]);
    });
  });
  describe('Test getRank', function() {
    it('Should return Warrior, 0 prestige (level 26)', function() {
      var response = levels.getRank(26);
      expect(response).to.deep.equal(['Warrior', 0, 16724787]);
    });
    it('Should return Vagabond, 1 prestige (level 100)', function() {
      var response = levels.getRank(100);
      expect(response).to.deep.equal(['Vagabond', 1, 8421504]);
    });
    it('Should return Vagabond, 1 prestige (level 350)', function() {
      var response = levels.getRank(350);
      expect(response).to.deep.equal(['Emperor', 3, 9181951]);
    });
    it('Should return Vagabond, 1 prestige (level 1000)', function() {
      var response = levels.getRank(1000);
      expect(response).to.deep.equal(['Vagabond', 10, 8421504]);
    });
  });
  describe('Test newMessage', function() {
    msg.content = 'test';
    it('User should have more than 0 XP', async function() {
      //To make sure
      await db.user.updateXP(msg.guild.id, '041025599435591424', 0);
      await levels.newMessage(msg);
      var xp = await db.user.getXP(msg.guild.id, '041025599435591424');
      expect(xp).to.be.above(0);
    });
    it('XP should not augment if spamming', async function() {
      /*This should be executed while the XP is still
        in cooldown because of the test before */
      await db.user.updateXP(msg.guild.id, '041025599435591424', 0);
      for (var i = 0; i < 5; i++) {
        await levels.newMessage(msg);
      }
      var xp = await db.user.getXP(msg.guild.id, '041025599435591424');
      expect(xp).to.be.equal(0);
    });
    it('Should return that the user has leveled up', async function() {
      await db.user.updateXP(msg.guild.id, '041025599435591424', 99);
      //Remove cooldown
      levels.__set__('lastMessages', []);
      await levels.newMessage(msg);
      expect(printMsg.lastCall.returnValue).to.equal(mustache.render(lang.general.member.leveled, {
        msg,
        progression: 2
      }));
    });
    it('Should return that the user ranked up', async function() {
      await db.user.updateXP(msg.guild.id, '041025599435591424', 989);
      //Remove cooldown
      levels.__set__('lastMessages', []);
      await levels.newMessage(msg);
      //Just one big expect to test if the returned value is correct
      expect(printMsg.lastCall.returnValue).to.equal(mustache.render(lang.general.member.leveled, {
          msg,
          progression: 10
        }) + '\n' +
        mustache.render(lang.general.member.rankUp, {
          rank: 'Farmer'
        }) + '!');
    });
    it('Should set the reward for the user (permission group)', async function() {
      //Set the reward for warrior
      await db.reward.updateRankReward(msg.guild.id, 'Warrior', 'Member');
      await db.user.updateXP(msg.guild.id, '041025599435591424', 2529);
      //Remove cooldown
      levels.__set__('lastMessages', []);
      await levels.newMessage(msg);
      var response = await db.user.getPermGroups(msg.guild.id, '041025599435591424');
      expect(response).to.equal('User,Member');
    })
    it('Should set the reward for the user (role)', async function() {
      await db.user.updateXP(msg.guild.id, '041025599435591424', 11684);
      //Add roles
      msg.guild.roles.set('2', {
        id: '2',
        name: 'guildMember'
      });
      //Set the reward for emperor
      await db.reward.updateRankReward(msg.guild.id, 'Emperor', '2');
      //Remove cooldown
      levels.__set__('lastMessages', []);
      await levels.newMessage(msg);
      expect(msg.member.roles.has('2')).to.equal(true);
    });
  });
});
//Delete all users from the database
async function purgeUsers() {
  await sql.open(config.pathDatabase);
  await sql.run('DELETE FROM user');
  await sql.close();
}
async function insertUser(serverId, userId, xp) {
  await sql.open(config.pathDatabase);
  await sql.run('INSERT INTO user (server_id, user_id, xp, warning, permission_group) VALUES (?, ?, ?, ?, ?)',
    [serverId, userId, xp, 0, null]);
  await sql.close();
  //Add user to collection
  testClient.users.set(`${userId}`, {
    username: `The${userId}`
  });
}
async function insertUsers(serverId, num) {
  await sql.open(config.pathDatabase);
  //Add users
  var users = [];
  for (var i = 0; i < num; i++) {
    var value = i * 10;
    //Add to list
    users.push(`(${serverId}, ${i}, ${value}, ${0}, ${null})`);
    //Add user to collection
    testClient.users.set(`${i}`, {
      username: `The${i}`
    });
  }
  //Bulk insert
  await sql.run('INSERT INTO user (server_id, user_id, xp, warning, permission_group) VALUES ' + users.join(', '));
  await sql.close();
}
describe('Test top', function() {
  it('Should return empty tops', async function() {
    await purgeUsers();
    await commands.executeCmd(msg, ['top']);
    var embed = msgSend.lastCall.returnValue.content;
    //Local
    expect(embed.fields[0].value).to.equal('***Total of 0 users***');
    //Global
    expect(embed.fields[1].value).to.equal('***Total of 0 users***');
  });
  it('Should return local with 1 user and global with 2 users', async function() {
    await insertUser(msg.guild.id, '01', 0);
    await insertUser('1289021', '02', 15);
    await commands.executeCmd(msg, ['top']);
    var embed = msgSend.lastCall.returnValue.content;
    //Local
    expect(embed.fields[0].value).to.equal(
      '**1. The01 🥇**\n⤷ Level: 1 | XP: 0\n***Total of 1 users***');
    //Global
    expect(embed.fields[1].value).to.equal(
      '**1. The02 🥇**\n⤷ Level: 1 | XP: 15\n**2. The01 🥈**\n⤷ Level: 1 ' +
      '| XP: 0\n***Total of 2 users***');
  });
  it('Global should merge same user', async function() {
    await insertUser('1289021', '01', 10);
    await commands.executeCmd(msg, ['top']);
    var embed = msgSend.lastCall.returnValue.content;
    //Local
    expect(embed.fields[0].value).to.equal(
      '**1. The01 🥇**\n⤷ Level: 1 | XP: 0\n***Total of 1 users***');
    //Global
    expect(embed.fields[1].value).to.equal(
      '**1. The02 🥇**\n⤷ Level: 1 | XP: 15\n**2. The01 🥈**\n⤷ Level: 1 ' +
      '| XP: 10\n***Total of 2 users***');
  });
  it('Test ordering of users', async function() {
    //Add users
    await insertUsers(msg.guild.id, 20);
    await insertUsers('2', 20);
    await commands.executeCmd(msg, ['top']);
    var embed = msgSend.lastCall.returnValue.content;
    //Local
    expect(embed.fields[0].value).to.equal(
      '**1. The19 🥇**\n⤷ Level: 2 | XP: 190\n**2. The18 🥈**\n⤷ Level: 2 ' +
      '| XP: 180\n**3. The17 🥉**\n⤷ Level: 2 | XP: 170\n**4. The16 **\n' +
      '⤷ Level: 2 | XP: 160\n**5. The15 **\n⤷ Level: 2 | XP: 150\n**6. ' +
      'The14 **\n⤷ Level: 2 | XP: 140\n**7. The13 **\n⤷ Level: 2 | XP: 130' +
      '\n**8. The12 **\n⤷ Level: 2 | XP: 120\n**9. The11 **\n⤷ Level: 2 | ' +
      'XP: 110\n**10. The10 **\n⤷ Level: 2 | XP: 100\n***Total of 21 users***');
    //Global
    expect(embed.fields[1].value).to.equal(
      '**1. The19 🥇**\n⤷ Level: 4 | XP: 380\n**2. The18 🥈**\n⤷ Level: 4 | ' +
      'XP: 360\n**3. The17 🥉**\n⤷ Level: 4 | XP: 340\n**4. The16 **\n' +
      '⤷ Level: 4 | XP: 320\n**5. The15 **\n⤷ Level: 3 | XP: 300\n**6.' +
      ' The14 **\n⤷ Level: 3 | XP: 280\n**7. The13 **\n⤷ Level: 3 | XP: 260' +
      '\n**8. The12 **\n⤷ Level: 3 | XP: 240\n**9. The11 **\n⤷ Level: 3 | ' +
      'XP: 220\n**10. The10 **\n⤷ Level: 3 | XP: 200\n***Total of 22 users***');
  });
});
describe('Test the custom commands', function() {
  describe('Test custcmd', function() {
    it('custcmd should return wrong usage', async function() {
      msg.content = '$custcmd';
      await commands.executeCmd(msg, ['custcmd']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.usage);
    });
    it('custcmd should add the command to the database', async function() {
      msg.content = '$custcmd testCmd1 say This is a test';
      await commands.executeCmd(msg, ['custcmd']);
      var response = await db.customCmd.getCmd(msg.guild.id, 'testCmd1');
      expect(response.name).to.equal('testCmd1');
      expect(printMsg.lastCall.returnValue).to.equal(lang.custcmd.cmdAdded);
    });
    it('custcmd should return wrong usage when using a too long name', async function() {
      msg.content = '$custcmd thisNameIsReallyTooLongToBeACustomCmd say This is a test';
      await commands.executeCmd(msg, ['custcmd']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.usage);
    });
    it('custcmd should return that the command already exists', async function() {
      msg.content = '$custcmd testCmd1 say This is a test';
      await commands.executeCmd(msg, ['custcmd']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.cmdAlreadyExists);
    });
    it('custcmd should return that the user has too many commands', async function() {
      msg.content = '$custcmd testCmd2 say This is a test';
      config.custcmd.maxCmdsPerUser = 1;
      await commands.executeCmd(msg, ['custcmd']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.tooMuch.cmdsUser);
    });
    it('custcmd should add the command to the database when using an administrator', async function() {
      msg.content = '$custcmd testCmd2 say This is a test';
      msg.member.permissions.set('ADMINISTRATOR');
      await commands.executeCmd(msg, ['custcmd']);
      var response = await db.customCmd.getCmd(msg.guild.id, 'testCmd2');
      expect(response.name).to.equal('testCmd2');
      expect(printMsg.lastCall.returnValue).to.equal(lang.custcmd.cmdAdded);
    });
  });
  describe('Test removeCmd', function() {
    it('Should return command not found', async function() {
      msg.content = '$custcmd testCmd3';
      await commands.executeCmd(msg, ['custcmdremove']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.notFound.cmd);
    });
    it('Should remove testCmd2', async function() {
      msg.content = '$custcmd testCmd2';
      await commands.executeCmd(msg, ['custcmdremove']);
      var response = await db.customCmd.getCmd(msg.guild.id, 'testCmd2');
      expect(response).to.equal(undefined);
      expect(printMsg.lastCall.returnValue).to.equal(lang.custcmdremove.cmdRemoved);
    });
  });
  describe('Test custcmdlist', function() {
    it('Should return info about testCmd1', async function() {
      msg.content = '$custcmdlist testCmd1';
      await commands.executeCmd(msg, ['custcmdlist']);
      var embed = msgSend.lastCall.returnValue.content.embed;
      expect(embed.title).to.equal('testCmd1');
      expect(embed.fields[0].value).to.equal('say');
      expect(embed.fields[1].value).to.equal('TestUser');
      expect(embed.fields[2].value).to.equal('This is a test');
    });
    it('Should return all custom commands', async function() {
      msg.author.id = '357156661105365963';
      //Add another custom cmd
      await db.customCmd.insertCmd(msg.guild.id, msg.author.id, 'testCmd2', 'say', '2');
      msg.author.id = '041025599435591424';
      msg.content = '$custcmdlist';
      await commands.executeCmd(msg, ['custcmdlist']);
      var response = msgSend.getCall(msgSend.callCount - 2).returnValue.content;
      expect(response).to.have.string('testCmd1');
      expect(response).to.have.string('testCmd2');
    })
    it('Should return all TestUser\'s custom commands', async function() {
      //Add another custom cmd
      await db.customCmd.insertCmd(msg.guild.id, msg.author.id, 'testCmd3', 'say', '3');
      msg.content = '$custcmdlist';
      await commands.executeCmd(msg, ['custcmdlist']);
      var response = msgSend.getCall(msgSend.callCount - 2).returnValue.content;
      expect(response).to.have.string('testCmd1');
      expect(response).to.have.string('testCmd3');
    });
    it('Should return that the list is empty', async function() {
      //Remove all inside of table
      await sql.open(config.pathDatabase);
      await sql.run('DELETE FROM custom_command');
      await sql.close();
      msg.content = '$custcmdlist';
      await commands.executeCmd(msg, ['custcmdlist']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.custcmdlist.empty);
    });
  });
});
describe('Test the audio player', function() {
  //Setup
  let videoId
  var oldVoiceChannel = msg.member.voiceChannel
  var oldGetVideoInfo = audioPlayer.__get__('getVideoInfo');
  audioPlayer.__set__({
    get: function(url) {
      //Remove start of url
      url = url.split('https://www.googleapis.com/youtube/v3/')[1].split('?');
      //Seperate other values
      url = url.concat(url[1].split('&'));
      url.splice(1, 1);
      if (url[0] == 'search') {
        var tag = url[2].split('q=')[1];
        if (tag == 'noResults') {
          return {
            items: []
          }
        }
        return youtube.search(tag);
      } else if (url[0] == 'videos') {
        var id = url[2].split('id=')[1];
        if (id == 'unavailable123') {
          return {
            items: []
          }
        }
        return youtube.videos(id);
      }
    },
    getVideoInfo: function(msg, video) {
      videoId = video;
    }
  });
  var downloadVideo = sinon.stub(audioPlayer, 'downloadVideo');
  downloadVideo.returnsArg(0);
  //Test beginning
  describe('Test playYoutube', function() {
    it('Should return wrong usage', function() {
      audioPlayer.playYoutube(msg, '');
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.usage);
    });
    it('Should return missing voiceChannel', function() {
      msg.member.voiceChannel = undefined;
      audioPlayer.playYoutube(msg, ['pet']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.notFound.voiceChannel);
    });
    it('Should return a video with a test tag', async function() {
      msg.member.voiceChannel = oldVoiceChannel;
      await audioPlayer.playYoutube(msg, ['test']);
      expect(videoId).to.equal('test123');
    });
    it('Should return not found if no video found', async function() {
      await audioPlayer.playYoutube(msg, ['noResults']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.notFound.video);
    });
    it('Should return video ID of the url', async function() {
      await audioPlayer.playYoutube(msg, ['https://www.youtube.com/watch?v=jNQXAC9IVRw']);
      expect(videoId).to.equal('jNQXAC9IVRw');
    });
  });
  describe('Test getQueue', function() {
    it('Should create a new queue and return it', function() {
      var response = audioPlayer.__get__('getQueue')('1');
      expect(response.id).to.equal('1');
    });
    it('Should return the first queue', function() {
      //Create another queue
      audioPlayer.__get__('getQueue')('2');
      var response = audioPlayer.__get__('getQueue')('1');
      expect(response.id).to.equal('1');
    });
  });
  var guildQueue = audioPlayer.__get__('getQueue')(msg.guild.id);
  describe('Test getVideoInfo', function() {
    it('Should return a video', async function() {
      await oldGetVideoInfo(msg, 'CylLNY-WSJw');
      expect(guildQueue.queue[0].id).to.equal('CylLNY-WSJw');
    });
    it('Should return an error when the video unavailable', async function() {
      await oldGetVideoInfo(msg, 'unavailable123');
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.play.unavailable);
    });
  });
  describe('Test addToQueue', function() {
    it('Should join a channel and start playing', async function() {
      //Clear the queue
      guildQueue.queue = [];
      var video = {
        id: 'test123',
        title: 'test123',
        duration: '3M'
      }
      await guildQueue.addToQueue(msg, video);
      expect(guildQueue.queue[0].id).to.equal('test123');
      expect(guildQueue.connection).to.exist;
    });
    it('Should put the next video in queue', async function() {
      var video = {
        id: 'test1234',
        title: 'test1234',
        duration: '3M'
      }
      await guildQueue.addToQueue(msg, video);
      expect(guildQueue.queue[1].id).to.equal('test1234');
      expect(msgSend.lastCall.returnValue.content).to.equal(mustache.render(lang.play.added, video));
    })
  });
  describe('Test playQueue', function() {
    it('Should play the next video', function() {
      guildQueue.connection.dispatcher.end();
      expect(guildQueue.connection).to.exist;
    });
    it('Should leave the channel after playing the last video', function() {
      guildQueue.connection.dispatcher.end();
      expect(guildQueue.connection).to.equal(undefined);
    });
  });
  describe('Test stop', function() {
    it('Should return not playing anything', function() {
      msg.content = '$stop';
      new audioPlayer.StopCommand().execute(msg, ['']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.notPlaying);
    });
    it('Should disconnect from voice channel', function() {
      guildQueue.connection = {
        disconnect: function() {
          return;
        }
      };
      new audioPlayer.StopCommand().execute(msg, ['']);
      expect(guildQueue.connection).to.equal(undefined);
      expect(printMsg.lastCall.returnValue).to.equal(lang.play.disconnected);
    });
  });
  describe('Test skip', function() {
    it('Should return not playing anything', function() {
      msg.content = '$skip';
      new audioPlayer.SkipCommand().execute(msg, ['']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.notPlaying);
    });
    it('Should skip the video playing', async function() {
      //Setup
      guildQueue.queue = [{
        id: 'test',
        title: 'This is a test!',
        duration: '3M'
      }, {
        id: 'test2',
        title: 'This is a test!',
        duration: '3M'
      }];
      await guildQueue.addToQueue(msg, {
        id: 'test3',
        title: 'This is a test!',
        duration: '3M'
      });
      //Real testing
      new audioPlayer.SkipCommand().execute(msg, ['']);
      expect(guildQueue.queue[0].id).to.equal('test2');
      expect(printMsg.lastCall.returnValue).to.equal(lang.play.skipped);
    });
  });
  describe('Test listQueue', function() {
    it('Should send empty queue', function() {
      guildQueue.queue = [];
      msg.content = '$queue';
      new audioPlayer.QueueCommand().execute(msg, ['']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.notPlaying);
    });
    it('Should send queue only for current video playing', function() {
      guildQueue.queue = [{
        id: 'test',
        title: 'test',
        duration: '3M'
      }];
      new audioPlayer.QueueCommand().execute(msg, ['']);
      expect(msgSend.lastCall.returnValue.content).to.equal('**Playing:** :notes: ```css\ntest ~ [3M]\n```');
    });
    it('Should send queue for 4 videos', function() {
      //Set the videos
      guildQueue.queue = guildQueue.queue.concat([{
        id: 'test2',
        title: 'test2',
        duration: '3M'
      }, {
        id: 'test3',
        title: 'test3',
        duration: '3M'
      }, {
        id: 'test4',
        title: 'test4',
        duration: '3M'
      }]);
      new audioPlayer.QueueCommand().execute(msg, ['']);
      expect(msgSend.lastCall.returnValue.content).to.equal(
        '**Playing:** :notes: ```css' +
        '\ntest ~ [3M]' +
        '\n```**In queue:** :notepad_spiral:```css' +
        '\n1. test2 ~ [3M]' +
        '\n2. test3 ~ [3M]' +
        '\n3. test4 ~ [3M]```');
    });
    it('Should send only the first 20 videos (+ the one playing)', function() {
      guildQueue.queue = [];
      //Add lot of videos
      for (var i = 0; i < 25; i++) {
        guildQueue.queue.push({
          id: 'test' + i,
          title: 'test' + i,
          duration: '3M'
        });
      }
      new audioPlayer.QueueCommand().execute(msg, ['']);
      expect(msgSend.lastCall.returnValue.content).to.equal(
        '**Playing:** :notes: ```css' +
        '\ntest0 ~ [3M]' +
        '\n```**In queue:** :notepad_spiral:```css' +
        '\n1. test1 ~ [3M]\n2. test2 ~ [3M]\n3. test3 ~ [3M]\n4. test4 ~ [3M]' +
        '\n5. test5 ~ [3M]\n6. test6 ~ [3M]\n7. test7 ~ [3M]\n8. test8 ~ [3M]' +
        '\n9. test9 ~ [3M]\n10. test10 ~ [3M]\n11. test11 ~ [3M]\n12. test12 ~ [3M]' +
        '\n13. test13 ~ [3M]\n14. test14 ~ [3M]\n15. test15 ~ [3M]\n16. test16 ~ [3M]' +
        '\n17. test17 ~ [3M]\n18. test18 ~ [3M]\n19. test19 ~ [3M]\n20. test20 ~ [3M]```');
    });
  });
});
describe('Test warnings', function() {
  describe('Test warn', function() {
    it('Should return wrong usage', function() {
      msg.mentions.users.clear();
      warnings.warn(msg, 1);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.usage);
    });
    it('Should increase TestUser\'s warnings by one', async function() {
      msg.mentions.users.set('041025599435591424', {
        id: '041025599435591424'
      });
      await warnings.warn(msg, 1);
      var response = await db.user.getWarnings(msg.guild.id, '041025599435591424');
      expect(response).to.equal(1);
    });
    it('Should decrease TestUser\'s warnings by one', async function() {
      await warnings.warn(msg, -1);
      var response = await db.user.getWarnings(msg.guild.id, '041025599435591424');
      expect(response).to.equal(0);
    });
  });
  describe('Test list', function() {
    it('Should return no warnings', async function() {
      msg.content = '$warnlist';
      await commands.executeCmd(msg, ['warnlist']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.warn.noWarns);
    });
    it('Should return all warnings', async function() {
      //Add warnings to users
      msg.mentions.users.clear();
      msg.mentions.users.set('357156661105365963', {
        id: '357156661105365963'
      });
      await warnings.warn(msg, 3);
      msg.mentions.users.clear();

      msg.mentions.users.set('041025599435591424', {
        id: '041025599435591424'
      });
      await warnings.warn(msg, 2);

      msg.content = '$warnlist';
      await commands.executeCmd(msg, ['warnlist']);
      expect(printMsg.lastCall.returnValue).to.equal(
        '<@041025599435591424>: 2 warnings\n<@357156661105365963>: 3 warnings');
    });
    it('Should return TestUser\'s warnings', async function() {
      msg.content = '$warnlist <@041025599435591424>';
      await commands.executeCmd(msg, ['warnlist']);
      expect(printMsg.lastCall.returnValue).to.equal('<@041025599435591424>: 2 warnings');
    });
  });
  describe('Test purge', function() {
    it('Should return wrong usage', async function() {
      msg.mentions.users.clear();
      msg.content = '$warnpurge';
      await commands.executeCmd(msg, ['warnpurge']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.usage);
    });
    it('Should purge TestUser', async function() {
      msg.mentions.users.set('041025599435591424', {
        id: '041025599435591424'
      });
      msg.content = '$warnpurge';
      await commands.executeCmd(msg, ['warnpurge']);
      var response = await db.user.getWarnings(msg.guild.id, '041025599435591424');
      expect(response).to.equal(0);
    });
    it('Should purge all', async function() {
      await warnings.warn(msg, 1);
      msg.content = '$warnpurge all';
      await commands.executeCmd(msg, ['warnpurge']);
      var response = await db.user.getUsersWarnings(msg.guild.id);
      expect(response[0].warning).to.equal(0);
      expect(response[1].warning).to.equal(0);
    });
  });
});
describe('Test checkPerm', function() {
  it('Should return true when user has the permLvl', async function() {
    //Setup
    msg.mentions.users.set(msg.author.id, {
      id: msg.author.id
    });
    await commands.executeCmd(msg, ['purgegroups']);
    msg.member.permissions.clear();
    var response = await commands.checkPerm(msg, 0);
    expect(response).to.equal(true);
  });
  it('Should return false when user don\'t have the permLvl', async function() {
    var response = await commands.checkPerm(msg, 1);
    expect(response).to.equal(false);
  });
  it('Should return true if user now have permLvl', async function() {
    await permGroups.setGroup(msg, msg.author, 'Member');
    var response = await commands.checkPerm(msg, 1);
    expect(response).to.equal(true);
  });
  it('Should return true if user has multiple permGroups', async function() {
    await permGroups.setGroup(msg, msg.author, 'User');
    var response = await commands.checkPerm(msg, 1);
    expect(response).to.equal(true);
  });
  it('Should return true if user has ADMINISTRATOR permissions', async function() {
    msg.member.permissions.set('ADMINISTRATOR');
    var response = await commands.checkPerm(msg, 3);
    expect(response).to.equal(true);
  })
  it('Should return true if user is a superuser', async function() {
    msg.member.permissions.clear();
    config.superusers = [msg.author.id];
    var response = await commands.checkPerm(msg, 3);
    expect(response).to.equal(true);
  });
  after(async function() {
    //Clean up
    config.superusers = [''];
    await commands.executeCmd(msg, ['purgegroups']);
  })
});
//Future stub
var checkPerm;
describe('Validate if message is a command', function() {
  it('Should return false when using a false command', async function() {
    //Change content of message
    msg.content = 'randomString';
    var response = await commands.checkIfValidCmd(msg, ['randomString']);
    expect(response).to.equal(false);
  });
  it('Should return false when using wrong prefix', async function() {
    msg.content = '!help';
    var response = await commands.checkIfValidCmd(msg, ['help']);
    expect(response).to.equal(false);
  });
  before(function() {
    checkPerm = sinon.stub(commands, 'checkPerm');
    checkPerm.resolves(true);
  });
  it('Should return true when using a real command', async function() {
    msg.content = '$help';
    var response = await commands.checkIfValidCmd(msg, ['help']);
    expect(response).to.equal(true);
  })
  it('Should return true with aliases', async function() {
    msg.content = '$help';
    var response = await commands.checkIfValidCmd(msg, ['cc']);
    expect(response).to.equal(true);
  });
  it('Should return false if command is deactivated', async function() {
    config.help.activated = false
    var response = await commands.checkIfValidCmd(msg, ['help']);
    expect(response).to.equal(false);
  });
  it('Should return false when user doesn\'t have permission to execute', async function() {
    config.help.activated = true
    checkPerm.resolves(false);
    var response = await commands.checkIfValidCmd(msg, ['help']);
    expect(response).to.equal(false);
  });
  after(function() {
    checkPerm.resolves(true);
  })
});
describe('Test commands', function() {
  describe('help', function() {
    it('Should return all commands', function() {
      commands.executeCmd(msg, ['help']);
      //Not the best solution because we only check the end of the message
      var expectedString = mustache.render(lang.help.msg, {
        config
      });
      expect(msgSend.lastCall.returnValue.content).to.equal(expectedString);
    });
    it('Should return help for ping', function() {
      msg.content = '$help ping'
      commands.executeCmd(msg, ['help', 'ping']);
      var embed = msgSend.lastCall.returnValue.content.embed;
      /*Test embed
       *TODO stop using hard coded values
       *Title */
      expect(embed.title).to.equal('$ping');
      //Description
      expect(embed.fields[0].value).to.equal(lang.help.ping.msg);
      //Permission level
      expect(embed.fields[1].value).to.equal('0');
      //Usage
      expect(embed.fields[2].value).to.equal('$ping \n');
    });
    it('Should return error message when using a wrong command as an argument', function() {
      msg.content = '$help aWrongCmd';
      commands.executeCmd(msg, ['help', 'aWrongCmd']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.invalidArg.cmd);
    })
  });
  describe('ping', function() {
    it('Should return "Pong!"', function() {
      commands.executeCmd(msg, ['ping']);
      expect(reply.lastCall.returnValue).to.equal(lang.ping.pong)
    });
  });
  describe('info', function() {
    it('Should return infos', function() {
      commands.executeCmd(msg, ['info']);
      var embed = msgSend.lastCall.returnValue.content.embed;
      var pjson = require('../package.json');
      //Test embed
      expect(embed.fields[0].value).to.have.string(pjson.name);
      expect(embed.fields[0].value).to.have.string(pjson.description);
      expect(embed.fields[0].value).to.have.string(pjson.author);
      expect(embed.fields[0].value).to.have.string(pjson.version);
      expect(embed.fields[1].value).to.have.string(config.locale);
      expect(embed.footer.text).to.have.string('testID');
    });
  });
  describe('status', function() {
    it('Should change the status in config', function() {
      var Status = rewire('../src/modules/general/status.js');
      var response;
      Status.__set__('modifyText', function(path, oldStatus, newStatus) {
        response = newStatus;
      });

      msg.content = '$status New status!';
      new Status().execute(msg, ['New status!']);
      //Check the API has been called with right argument
      expect(setActivity.lastCall.returnValue).to.equal('New status!');
      //Check if config was "modified" (stub) with righ argument
      //TODO: Better expect here
      expect(response).to.equal("currentStatus: 'New status!");
    });
  });
  describe('say', function() {
    it('Should return the message', function() {
      msg.content = '$say here test';
      commands.executeCmd(msg, ['say', 'here', 'test']);
      expect(msgSend.lastCall.returnValue.content).to.equal('test');
    });
    it('Should return missing argument: channel', function() {
      msg.content = '$say test';
      commands.executeCmd(msg, ['say', 'test']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.missingArg.channel);
    });
    it('Should return the message in the channel with ID 42', function() {
      msg.content = '$say <#42> test';
      commands.executeCmd(msg, ['say', '<#42>', 'test']);
      expect(channelSend.lastCall.returnValue).to.equal('test');
    });
    it('Should return missing argument: channel when using wrong channel', function() {
      msg.content = '$say badString test';
      commands.executeCmd(msg, ['say', 'badString', 'test']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.missingArg.channel);
    });
    it('Should return missing argument: message', function() {
      msg.content = '$say here';
      commands.executeCmd(msg, ['say', 'here']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.missingArg.message);
    })
  });
  describe('avatar', function() {
    it('Should return TestUser\'s avatar', function() {
      var id = '041025599435591424';
      var url = 'https://cdn.discordapp.com/avatars/041025599435591424/';
      //Add mention
      msg.mentions.users.set(id, {
        avatarURL: url
      });
      msg.content = `$avatar <#${id}>`;
      commands.executeCmd(msg, ['avatar', `<#${id}>`]);
      expect(printMsg.lastCall.returnValue).to.equal(url);
      msg.mentions.users.delete(id);
    });
    it('Should return invalid user when there is no mention of a user', function() {
      msg.content = '$avatar';
      commands.executeCmd(msg, ['avatar']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.invalidArg.user);
    });
  });
  describe('profile', function() {
    it('Should return the message author\'s (TestUser) profile', async function() {
      //Add XP
      await db.user.updateXP(msg.guild.id, msg.author.id, 11685);
      await db.user.updateXP('9', msg.author.id, 8908);
      //Add member to groups
      await permGroups.setGroup(msg, msg.author, 'Member');
      msg.content = '$profile';
      await commands.executeCmd(msg, ['profile']);
      var embed = msgSend.lastCall.returnValue.content.embed;
      expect(embed.title).to.equal('TestUser\'s profile');
      expect(embed.fields[0].value).to.equal('**Bio:** ```This user doesn\'t ' +
        'have a bio!```\n**Birthday:** Unknown | **Location** Unknown\n' +
        '**Account created since:** 2009-12-24');
      expect(embed.fields[1].value).to.equal('Rank: Emperor\n' +
        'Position: #1\nLevel: 50 (0/450)\nTotal XP: 11685');
      expect(embed.fields[2].value).to.equal('Rank: XP Master\n' +
        'Position: #1\nLevel: 66 (358/635)\nTotal XP: 20593');
      expect(embed.fields[3].value).to.equal('Member, User');
      expect(embed.fields[4].value).to.equal('0');
      expect(embed.footer).to.exist;
    });
    it('Should add superuser to list of permission groups', async function() {
      msg.content = '$profile';
      config.superusers = ['041025599435591424'];
      await commands.executeCmd(msg, ['profile']);
      var embed = msgSend.lastCall.returnValue.content.embed;
      expect(embed.fields[3].value).to.equal('Superuser, Member, \nUser');
    });
    it('Should add bio, birthday, and location', async function() {
      //Setup
      await db.user.updateBio(msg.guild.id, msg.author.id, 'Test bio');
      await db.user.updateBirthday(msg.guild.id, msg.author.id, '--02-01');
      await db.user.updateLocation(msg.guild.id, msg.author.id, 'There');
      //Actual command
      msg.content = '$profile';
      await commands.executeCmd(msg, ['profile']);
      var embed = msgSend.lastCall.returnValue.content.embed;
      expect(embed.fields[0].value).to.equal('**Bio:** ```Test bio```\n' +
        '**Birthday:** --02-01 | **Location** There\n' +
        '**Account created since:** 2009-12-24');
    });
    it('Should return George\'s profile', async function() {
      var id = '357156661105365963';
      //Add mention
      msg.mentions.users.set(id, {
        id: id,
        username: 'George',
        createdAt: new Date(1985, 10, 16)
      });
      msg.content = `$profile <#${id}>`;
      await commands.executeCmd(msg, ['profile', `<#${id}>`])
      var embed = msgSend.lastCall.returnValue.content.embed;
      expect(embed.fields[0].value).to.equal('**Bio:** ```This user doesn\'t ' +
        'have a bio!```\n**Birthday:** Unknown | **Location** Unknown\n' +
        '**Account created since:** 1985-11-16');
      expect(embed.fields[1].value).to.equal('Rank: Vagabond\n' +
        'Position: #23\nLevel: 1 (0/100)\nTotal XP: 0');
      expect(embed.fields[2].value).to.equal('Rank: Vagabond\n' +
        'Position: #24\nLevel: 1 (0/100)\nTotal XP: 0');
      expect(embed.fields[3].value).to.equal('User');
      expect(embed.fields[4].value).to.equal('0');
      expect(embed.footer).to.exist;
    });
    after(async function() {
      await db.user.updateBio(msg.guild.id, msg.author.id, null);
      await db.user.updateBirthday(msg.guild.id, msg.author.id, null);
      await db.user.updateLocation(msg.guild.id, msg.author.id, null);
    });
  });
  describe('modifyprofile', function() {
    describe('Test bad arguments', function() {
      it('Should return missing argument field', async function() {
        msg.content = '$modifyprofile';
        await commands.executeCmd(msg, ['modifyprofile']);
        var result = msgSend.lastCall.returnValue.content;
        expect(result).to.equal(lang.error.missingArg.field);
      });
      it('Should return missing argument value', async function() {
        msg.content = '$modifyprofile test';
        await commands.executeCmd(msg, ['modifyprofile']);
        var result = msgSend.lastCall.returnValue.content;
        expect(result).to.equal(lang.error.missingArg.value);
      });
      it('Should return invalid argument field', async function() {
        msg.content = '$modifyprofile test test';
        await commands.executeCmd(msg, ['modifyprofile']);
        var result = msgSend.lastCall.returnValue.content;
        expect(result).to.equal(lang.error.invalidArg.field);
      });
    });
    describe('Test validation of input', function() {
      it('The bio field should return that there is too much chars', async function() {
        msg.content = '$modifyprofile bio Lorem ipsum dolor sit amet, ' +
          'nostrud civibus mel ne, eu sea nostrud epicurei urbanitas, ' +
          'eam ex sonet repudiare. Ex debet tation cum, ex qui graeci ' +
          'senserit definiebas, sint dolorem definitionem eam ne. ' +
          'Eum doctus impedit prodesset ad, habeo justo dicunt te est. ' +
          'Vel eruditi eligendi imperdiet et, mea no dolor propriae deseruisse. ' +
          'Reque populo maluisset ne has, has decore ullamcorper ad, ' +
          'commodo iracundia ea nec.';
        await commands.executeCmd(msg, ['modifyprofile']);
        var result = msgSend.lastCall.returnValue.content;
        var response = await db.user.getAll(msg.guild.id, msg.author.id);
        expect(result).to.equal(mustache.render(lang.error.tooMuch.chars, {
          max: 280
        }));
        //Make sure the db was not modified
        expect(response.bio).to.equal(null);
      });
      it('The birthday field should return that the format is wrong', async function() {
        msg.content = '$modifyprofile birthday test';
        await commands.executeCmd(msg, ['modifyprofile']);
        var result = msgSend.lastCall.returnValue.content;
        var response = await db.user.getAll(msg.guild.id, msg.author.id);
        expect(result).to.equal(lang.error.formatError);
        //Make sure the db was not modified
        expect(response.birthday).to.equal(null);
      });
    });
    describe('Test if the command actually works', function() {
      it('Should change bio to lorem ipsum', async function() {
        msg.content = '$modifyprofile bio lorem ipsum';
        await commands.executeCmd(msg, ['modifyprofile']);
        var response = await db.user.getAll(msg.guild.id, msg.author.id);
        expect(response.bio).to.equal('lorem ipsum');
      });
      it('Should change birthday to 1971-01-01', async function() {
        msg.content = '$modifyprofile birthday 1971-01-01';
        await commands.executeCmd(msg, ['modifyprofile']);
        var response = await db.user.getAll(msg.guild.id, msg.author.id);
        expect(response.birthday).to.equal('1971-01-01');
      });
      it('Should change location to there', async function() {
        msg.content = '$modifyprofile location there';
        await commands.executeCmd(msg, ['modifyprofile']);
        var response = await db.user.getAll(msg.guild.id, msg.author.id);
        expect(response.location).to.equal('there');
      });
    });
  });
  describe('setgroup', function() {
    it('Should add "Mod" to the list of groups of TestUser', async function() {
      msg.mentions.users.clear();
      msg.mentions.users.set('041025599435591424', {
        id: '041025599435591424'
      });
      msg.content = '$setgroup <#041025599435591424> Mod'
      await commands.executeCmd(msg, ['setgroup']);
      var response = await db.user.getPermGroups(msg.guild.id, '041025599435591424');
      expect(response).to.equal('User,Member,Mod');
    });
  });
  describe('unsetgroup', function() {
    it('Should remove "User" from the list of groups of TestUser', async function() {
      msg.content = '$unsetgroup <#041025599435591424> User'
      await commands.executeCmd(msg, ['unsetgroup', '<#041025599435591424>', 'User']);
      var response = await db.user.getPermGroups(msg.guild.id, '041025599435591424');
      expect(response).to.equal('Member,Mod');
    });
  });
  describe('purgegroups', function() {
    it('Should get TestUser back to User', async function() {
      msg.content = '$purgegroups <#041025599435591424>'
      await commands.executeCmd(msg, ['purgegroups', '<#041025599435591424>']);
      var response = await db.user.getPermGroups(msg.guild.id, '041025599435591424');
      expect(response).to.equal('User');
    });
  });
  describe('gif', function() {
    it('Should return a gif', async function() {
      msg.content = '$gif dog';
      await new giphy.GifCommand().execute(msg, ['dog']);
      expect(msgSend.lastCall.returnValue.content).to.equal('A gif');
    });
  });
  describe('gifrandom', function() {
    it('Should return a random gif', async function() {
      msg.content = '$gifrandom dog';
      await new giphy.GifRandomCommand().execute(msg, ['dog']);
      expect(msgSend.lastCall.returnValue.content).to.equal('A random gif');
    })
  });
  describe('flipcoin', function() {
    it('Should return head or tail', function() {
      commands.executeCmd(msg, ['flipcoin']);
      expect(reply.lastCall.returnValue).to.be.oneOf(['heads', 'tails']);
    });
  });
  describe('roll', function() {
    function separateValues(string) {
      var values = string.split(' = ');
      var dice = values[0].split(' + ');
      var sum = values[1];
      return [dice, sum];
    }
    it('Should return the result of one six faced die', function() {
      msg.content = '$roll 1d6';
      commands.executeCmd(msg, ['roll']);

      var result = separateValues(msgSend.lastCall.returnValue.content);
      expect(parseInt(result[1])).to.be.above(0);
      expect(parseInt(result[1])).to.be.below(7);
    });
    it('Should return the result of two 20 faced dice', function() {
      msg.content = '$roll 2d20';
      commands.executeCmd(msg, ['roll']);
      var result = separateValues(msgSend.lastCall.returnValue.content);
      expect(parseInt(result[1])).to.be.above(0);
      expect(parseInt(result[1])).to.be.below(41);
    });
    it('Should return the result of three 12 faced dice + 5', function() {
      msg.content = '$roll 3d12+5';
      commands.executeCmd(msg, ['roll']);
      var result = separateValues(msgSend.lastCall.returnValue.content);
      expect(parseInt(result[1])).to.be.above(7);
      expect(parseInt(result[1])).to.be.below(42);
    })
    it('Should return 1d6 when using wrong input', function() {
      msg.content = '$roll randomString';
      commands.executeCmd(msg, ['roll']);

      var result = separateValues(msgSend.lastCall.returnValue.content);
      expect(parseInt(result[1])).to.be.above(0);
      expect(parseInt(result[1])).to.be.below(7);
    });
    it('Should return 1d6 when using no argument', function() {
      msg.content = '$roll';
      commands.executeCmd(msg, ['roll']);

      var result = separateValues(msgSend.lastCall.returnValue.content);
      expect(parseInt(result[1])).to.be.above(0);
      expect(parseInt(result[1])).to.be.below(7);
    });
  });
  describe('clearlog', function() {
    it('Should delete nothing', async function() {
      msg.content = '$clearlog 1';
      await commands.executeCmd(msg, ['clearlog', '1']);
      var deletedMessages = testMessages.__get__('deletedMessages');
      expect(deletedMessages).to.deep.equal([]);
    });
    it('Should delete commands and messages by client', async function() {
      msg.content = '$clearlog';
      await commands.executeCmd(msg, ['clearlog']);
      var deletedMessages = testMessages.__get__('deletedMessages');
      expect(deletedMessages).to.deep.equal(['$ping', 'this', '$info', '$help help', 'a', '$profile']);
    })
    it('Should delete message containing "This is a test"', async function() {
      msg.mentions.users.clear();
      msg.content = '$clearlog This is a test 10';
      //Reset deletedMessages
      testMessages.__set__('deletedMessages', []);
      await commands.executeCmd(msg, ['clearlog']);
      var deletedMessages = testMessages.__get__('deletedMessages');
      expect(deletedMessages).to.deep.equal(['This is a test 123']);
    })
    it('Should delete messages by user with id 384633488400140664', async function() {
      msg.mentions.users.set('384633488400140664', {
        id: '384633488400140664'
      });
      msg.content = '$clearlog <@384633488400140664> 15';
      //Reset deletedMessages
      testMessages.__set__('deletedMessages', []);
      await commands.executeCmd(msg, ['clearlog']);
      var deletedMessages = testMessages.__get__('deletedMessages');
      expect(deletedMessages).to.deep.equal(['flower', 'pot']);
    });
    it('Should delete messages by user with id 384633488400140664 if changed nickname', async function() {
      msg.mentions.users.set('384633488400140664', {
        id: '384633488400140664'
      });
      msg.content = '$clearlog <@!384633488400140664> 15';
      //Reset deletedMessages
      testMessages.__set__('deletedMessages', []);
      await commands.executeCmd(msg, ['clearlog']);
      var deletedMessages = testMessages.__get__('deletedMessages');
      expect(deletedMessages).to.deep.equal(['flower', 'pot']);
    });
    it('Should delete message with flower by user with id 384633488400140664', async function() {
      msg.content = '$clearlog <@384633488400140664> flower 15';
      //Reset deletedMessages
      testMessages.__set__('deletedMessages', []);
      await commands.executeCmd(msg, ['clearlog']);
      var deletedMessages = testMessages.__get__('deletedMessages');
      expect(deletedMessages).to.deep.equal(['flower']);
    });
    it('Should delete message with filters inversed', async function() {
      msg.content = '$clearlog flower <@384633488400140664> 15';
      //Reset deletedMessages
      testMessages.__set__('deletedMessages', []);
      await commands.executeCmd(msg, ['clearlog']);
      var deletedMessages = testMessages.__get__('deletedMessages');
      expect(deletedMessages).to.deep.equal(['flower']);
    });
  });
  describe('Test setreward', function() {
    it('Should return missing argument: rank', async function() {
      msg.content = 'setreward';
      await commands.executeCmd(msg, ['setreward']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.missingArg.rank);
    })
    it('Should return missing argument: reward', async function() {
      msg.content = 'setreward farmer';
      await commands.executeCmd(msg, ['setreward']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.missingArg.reward);
    });
    it('Should return invalid reward', async function() {
      msg.content = 'setreward test string';
      await commands.executeCmd(msg, ['setreward']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.invalidArg.reward);
    });
    it('Should return rank not found', async function() {
      msg.content = 'setreward test member';
      await commands.executeCmd(msg, ['setreward']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.notFound.rank);
    });
    it('Should set the reward for king (permission group) and create table', async function() {
      msg.content = 'setreward king member';
      await commands.executeCmd(msg, ['setreward']);
      var response = await db.reward.getRankReward(msg.guild.id, 'King');
      expect(response).to.equal('Member');
    });
    it('Should set the reward for emperor (role)', async function() {
      //Add roles
      msg.guild.roles.set('1', {
        id: '1'
      });
      msg.mentions.roles.set('1', {
        id: '1'
      });
      msg.content = 'setreward emperor <#1>';
      await commands.executeCmd(msg, ['setreward']);
      var response = await db.reward.getRankReward(msg.guild.id, 'Emperor');
      expect(response).to.equal('1');
    });
    it('Should update the reward for emperor', async function() {
      msg.guild.roles.clear();
      msg.mentions.roles.clear();
      //Add roles
      msg.guild.roles.set('2', {
        id: '2'
      });
      msg.mentions.roles.set('2', {
        id: '2'
      });
      msg.content = 'setreward emperor <#2>';
      await commands.executeCmd(msg, ['setreward']);
      var response = await db.reward.getRankReward(msg.guild.id, 'Emperor');
      expect(response).to.equal('2');
    });
    after(function() {
      msg.guild.roles.clear();
      msg.mentions.roles.clear();
    });
  });
  describe('Test unsetreward', function() {
    it('Should return missing argument: rank', async function() {
      msg.content = 'unsetreward';
      await commands.executeCmd(msg, ['unsetreward']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.missingArg.rank);
    });
    it('Should return rank not found', async function() {
      msg.content = 'unsetreward random';
      await commands.executeCmd(msg, ['unsetreward']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.notFound.rank);
    });
    it('Should return rank reward not found', async function() {
      msg.content = 'unsetreward farmer';
      await commands.executeCmd(msg, ['unsetreward']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.notFound.rankReward);
    });
    it('Should remove the reward for emperor', async function() {
      msg.content = 'unsetreward emperor';
      await commands.executeCmd(msg, ['unsetreward']);
      var response = await db.reward.getRankReward(msg.guild.id, 'Emperor');
      expect(response).to.equal(undefined);
    });
  });
});

after(async function() {
  //Make sure to delete the database at the end
  await deleteDatabase();
});
