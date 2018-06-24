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
const customCmd = require('../src/modules/fun/custom-cmd.js');
const audioPlayer = rewire('../src/modules/music/audio-player.js');
const top = rewire('../src/modules/user/top.js');
var setActivity = sinon.spy(bot.client().user, 'setActivity');
var channelSend = sinon.spy(bot.client().channels.get('42'), 'send');
var printMsg = sinon.stub(bot, 'printMsg');
printMsg.returnsArg(1);

//Init commands
const commands = require('../src/commands.js');

//Register stuff
commands.registerCategories(config.categories);
commands.registerCommands();

function deleteDatabase() {
  //Delete the test database if it exists
  var db = './test/test-resources/test-database.db';
  if (fs.existsSync(db)) {
    fs.unlinkSync(db);
  }
  //Delete the backup database if it exists
  var backup = './test/test-resources/database-backup-v000.db';
  if (fs.existsSync(backup)) {
    fs.unlinkSync(backup);
  }
}

async function getTables() {
  await sql.open(config.pathDatabase);
  var tables = await sql.all('SELECT * FROM sqlite_master WHERE type="table"');
  await sql.close();
  return tables;
}

async function getRowCount(path) {
  var count = 0;
  await sql.open(path);
  //Get all tables
  var tables = await sql.all('SELECT name FROM sqlite_master WHERE type="table"');
  for(table of tables) {
    count += (await sql.get(`SELECT count(*) FROM ${table.name}`))['count(*)'];
  }
  await sql.close();
  return count;
}

//Make console.log a spy
var spyLog = sinon.spy(console, 'log');

describe('Test database checker', function() {
  it('Should create table when they don\'t exist', async function() {
    //Just to be sure
    deleteDatabase();
    //Check database
    await db.checker.check();
    //Check if all tables exists
    var tables = await getTables();
    expect(tables[0].name).to.equal('database_settings');
    expect(tables[1].name).to.equal('users');
    expect(tables[2].name).to.equal('servers');
    expect(tables[3].name).to.equal('rewards');
    expect(tables[4].name).to.equal('customCmds');
    expect(tables.length).to.equal(5);
  });
  it('Should not attempt to create an existing table', async function() {
    //If there is an attempt there will be an error
    await db.checker.check();
    expect(spyLog.lastCall.args[0]).to.equal(mustache.render(lang.database.tableAdded, {
      num: 0
    }));
  });
  it('Should update database to version 001', async function() {
    //Delete old database
    deleteDatabase();
    //Copy and paste the test database
    var dbFile = fs.readFileSync('./test/test-resources/legacy-v000-database.db');
    fs.writeFileSync('./test/test-resources/test-database.db', dbFile);
    //Update database
    await db.checker.check();
    //Check backup
    var backup = './test/test-resources/database-backup-v000.db';
    expect(fs.existsSync(backup)).to.equal(true);
    expect(await getRowCount(backup)).to.equal(10);
    //Check db
    var tables = await getTables();
    expect(tables.length).to.equal(5);
    //Remove line breaks
    var statement = tables.filter(x => x.name == 'users')[0].sql.replace(/\r?\n?/g, '');
    //Quick and dirty way
    expect(statement).to.equal(
      'CREATE TABLE users(  serverID TEXT,  userId TEXT,  ' +
      'xp INTEGER DEFAULT 0,  warnings INTEGER DEFAULT 0,  ' +
      'groups TEXT DEFAULT "User",  CONSTRAINT users_unique UNIQUE (serverID,  userID))');
    expect(await getRowCount(config.pathDatabase)).to.equal(9);
  });
  it('Should make a fresh new database for rest of tests', async function() {
    //Delete old database
    deleteDatabase();
    //Create tables
    await db.checker.check();
  });
});
describe('Test users-db', function() {
  describe('Test get queries with empty responses', function() {
    it('user.getAll() should return undefined', async function() {
      var response = await db.users.user.getAll('1', '2');
      expect(response).to.equal(undefined);
    });
    it('user.getXp() should return 0', async function() {
      var response = await db.users.user.getXP('1', '2');
      expect(response).to.equal(0);
    });
    it('user.getWarnings() should return 0', async function() {
      var response = await db.users.user.getWarnings('1', '2');
      expect(response).to.equal(0);
    });
    it('users.getWarnings() should return empty array', async function() {
      var response = await db.users.getWarnings('1');
      expect(response).to.be.empty;
    });
    it('user.exists() should return false', async function() {
      var response = await db.users.user.exists('1', '2');
      expect(response).to.equal(false);
    });
    //Last because it does an insert if response is null
    it('user.getPermGroups() should return default role', async function() {
      var response = await db.users.user.getPermGroups('1', '2');
      expect(response).to.equal(config.groups[0].name);
    });
  });
  describe('Test update queries with empty database', async function() {
    it('user.updatePermGroups() should change group to Member', async function() {
      await db.users.user.updatePermGroups('1', '2', 'Member');
      var response = await db.users.user.getPermGroups('1', '2');
      expect(response).to.equal('Member');
    });
    it('user.updateXP() should change XP to 10000', async function() {
      await db.users.user.updateXP('1', '3', 10000);
      var response = await db.users.user.getXP('1', '3');
      expect(response).to.equal(10000);
    });
    it('user.updateWarnings() should change warnings to 4', async function() {
      await db.users.user.updateWarnings('1', '4', 4);
      var response = await db.users.user.getWarnings('1', '4');
      expect(response).to.equal(4);
    })
    it('users.updateWarnings() should change warnings to 1', async function() {
      await db.users.updateWarnings('1', 1);
      var response = await db.users.getWarnings('1');
      expect(response).to.deep.equal([{
        "userId": "2",
        "warnings": 1
      }, {
        "userId": "3",
        "warnings": 1
      }, {
        "userId": "4",
        "warnings": 1
      }]);
    });
  });
  describe('Test updating existing users', function() {
    it('user.updatePermGroups() should change group to Mod', async function() {
      await db.users.user.updatePermGroups('1', '2', 'Mod');
      var response = await db.users.user.getPermGroups('1', '2');
      expect(response).to.equal('Mod');
    });
    it('user.updateXP() should change XP to 15000', async function() {
      await db.users.user.updateXP('1', '3', 15000);
      var response = await db.users.user.getXP('1', '3');
      expect(response).to.equal(15000);
    });
    it('user.updateWarnings() should change warnings to 2', async function() {
      await db.users.user.updateWarnings('1', '4', 2);
      var response = await db.users.user.getWarnings('1', '4');
      expect(response).to.equal(2);
    })
    it('users.updateWarnings() should change warnings to 0', async function() {
      await db.users.updateWarnings('1', 0);
      var response = await db.users.getWarnings('1');
      expect(response).to.deep.equal([{
        "userId": "2",
        "warnings": 0
      }, {
        "userId": "3",
        "warnings": 0
      }, {
        "userId": "4",
        "warnings": 0
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
  describe('Test get queries with empty responses', function() {
    it('Should return first channel if no general', async function() {
      var response = await db.config.getDefaultChannel(msg.guild.id);
      expect(response.position).to.equal(0);
    });
    it('Should return general', async function() {
      var response = await db.config.getDefaultChannel('1234567890');
      expect(response.name).to.equal('general');
    })
  });
  describe('Test update queries', function() {
    it('Should insert channel into empty table', async function() {
      await db.config.updateDefaultChannel('1234567890', {id: '3'});
      var response = await db.config.getDefaultChannel('1234567890');
      expect(response.name).to.equal('test');
    })
    it('Should modify existing row', async function() {
      await db.config.updateDefaultChannel('1234567890', {id: '2'});
      var response = await db.config.getDefaultChannel('1234567890');
      expect(response.name).to.equal('general');
    })
  });
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
      var response = await db.users.user.getPermGroups(msg.guild.id, '041025599435591424');
      expect(response).to.equal('User');
    });
    it('Should add "Member" to the list of groups of TestUser', async function() {
      await permGroups.setGroup(msg, msg.author, 'Member');
      var response = await db.users.user.getPermGroups(msg.guild.id, '041025599435591424');
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
      var response = await db.users.user.getPermGroups(msg.guild.id, '041025599435591424');
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
      var response = await db.users.user.getPermGroups(msg.guild.id, '041025599435591424');
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
  describe('Test setReward', function() {
    it('Should return missing argument: rank', function() {
      levels.setReward(msg, []);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.missingArg.rank);
    })
    it('Should return missing argument: reward', function() {
      levels.setReward(msg, ['farmer']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.missingArg.reward);
    });
    it('Should return invalid reward', function() {
      levels.setReward(msg, ['test', 'string']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.invalidArg.reward);
    });
    it('Should return rank not found', function() {
      levels.setReward(msg, ['test', 'Member']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.notFound.rank);
    });
    it('Should set the reward for king (permission group) and create table', async function() {
      await levels.setReward(msg, ['king', 'Member']);
      response = await levels.__get__('getReward')(msg, ['King']);
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
      await levels.setReward(msg, ['emperor', '<#1>']);
      response = await levels.__get__('getReward')(msg, ['Emperor']);
      expect(response).to.equal('1');
    });
    it('Should update the reward for emperor', async function() {
      //Clear collections
      msg.guild.roles.clear();
      msg.mentions.roles.clear();
      //Add roles
      msg.guild.roles.set('2', {
        id: '2'
      });
      msg.mentions.roles.set('2', {
        id: '2'
      });
      await levels.setReward(msg, ['emperor', '<#2>']);
      response = await levels.__get__('getReward')(msg, ['Emperor']);
      expect(response).to.equal('2');
    });
    after(function() {
      msg.guild.roles.clear();
      msg.mentions.roles.clear();
    });
  });
  describe('Test unsetReward', function() {
    it('Should return missing argument: rank', function() {
      levels.unsetReward(msg, []);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.missingArg.rank);
    });
    it('Should remove the reward for emperor', async function() {
      await levels.unsetReward(msg, ['king']);
      response = await levels.__get__('getReward')(msg, ['King']);
      expect(response).to.equal(undefined);
    });
  });
  describe('Test newMessage', function() {
    msg.content = 'test';
    it('User should have more than 0 XP', async function() {
      //To make sure
      await db.users.user.updateXP(msg.guild.id, '041025599435591424', 0);
      await levels.newMessage(msg);
      var xp = await db.users.user.getXP(msg.guild.id, '041025599435591424');
      expect(xp).to.be.above(0);
    });
    it('XP should not augment if spamming', async function() {
      /*This should be executed while the XP is still
        in cooldown because of the test before */
      await db.users.user.updateXP(msg.guild.id, '041025599435591424', 0);
      for (var i = 0; i < 5; i++) {
        await levels.newMessage(msg);
      }
      var xp = await db.users.user.getXP(msg.guild.id, '041025599435591424');
      expect(xp).to.be.equal(0);
    });
    it('Should return that the user has leveled up', async function() {
      await db.users.user.updateXP(msg.guild.id, '041025599435591424', 99);
      //Remove cooldown
      levels.__set__('lastMessages', []);
      await levels.newMessage(msg);
      expect(printMsg.lastCall.returnValue).to.equal(mustache.render(lang.general.member.leveled, {
        msg,
        progression: 2
      }));
    });
    it('Should return that the user ranked up', async function() {
      await db.users.user.updateXP(msg.guild.id, '041025599435591424', 989);
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
      await levels.setReward(msg, ['warrior', 'Member']);
      await db.users.user.updateXP(msg.guild.id, '041025599435591424', 2529);
      //Remove cooldown
      levels.__set__('lastMessages', []);
      await levels.newMessage(msg);
      var response = await db.users.user.getPermGroups(msg.guild.id, '041025599435591424');
      expect(response).to.equal('User,Member');
    })
    it('Should set the reward for the user (role)', async function() {
      await db.users.user.updateXP(msg.guild.id, '041025599435591424', 11684);
      //Add roles
      msg.guild.roles.set('2', {
        id: '2',
        name: 'guildMember'
      });
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
  await sql.run('DELETE FROM users');
  await sql.close();
}
async function insertUser(serverId, userId, xp) {
  await sql.open(config.pathDatabase);
  await sql.run('INSERT INTO users (serverId, userId, xp, warnings, groups) VALUES (?, ?, ?, ?, ?)', [serverId, userId, xp, 0, null]);
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
  await sql.run('INSERT INTO users (serverId, userId, xp, warnings, groups) VALUES ' + users.join(', '));
  await sql.close();
}
describe('Test top', function() {
  var targetUser1 = {
    userId: '1234567890',
    xp: 0
  }
  var targetUser2 = {
    userId: '1',
    xp: 0
  }
  describe('Test getInfo', function() {
    var getInfo = top.__get__('getInfo');
    it('Should return empty array when no user', async function() {
      var response = await getInfo([]);
      expect(response).to.deep.equal([]);
    });
    it('Return more info about user', async function() {
      await insertUser('1234567890', '1234567890', 0);
      var response = await getInfo([targetUser1]);
      var expectedResponse = targetUser1;
      expectedResponse.level = 1;
      expectedResponse.username = 'The1234567890';
      expect(response).to.deep.equal([expectedResponse]);
    });
    it('Should work with wrong users', async function() {
      var response = await getInfo([targetUser1, targetUser2]);
      var expectedResponse = [targetUser1, targetUser2];
      expectedResponse[0].level = 1;
      expectedResponse[0].username = 'The1234567890';
      expect(response).to.deep.equal(expectedResponse);
    });
  });
  describe('Test getTops', function() {
    getTops = top.__get__('getTops');
    it('Should return empty tops', async function() {
      await purgeUsers();
      var response = await getTops(msg, 10);
      expect(response.local.length).to.equal(0);
      expect(response.global.length).to.equal(0);
    });
    it('Should return one user in each tops', async function() {
      await insertUser(msg.guild.id, '01', 0);
      await insertUser(msg.guild.id, '02', 15);
      var response = await getTops(msg, 1);
      var expectedResponse = {
        "level": 1,
        "userId": "02",
        "xp": 15,
        "username": "The02"
      }
      expect(response.local.length).to.equal(1);
      expect(response.local[0]).to.deep.equal(expectedResponse);
      expect(response.global.length).to.equal(1);
      expect(response.global[0]).to.deep.equal(expectedResponse);
    });
    it('Should return two user in each tops', async function() {
      //Also test when not enough users
      var response = await getTops(msg, 3);
      expect(response.local.length).to.equal(2);
      expect(response.global.length).to.equal(2);
    });
    it('Global should merge same user', async function() {
      await insertUser('1', '02', 10);
      var response = await getTops(msg, 10);
      expect(response.global[0]).to.deep.equal({
        "level": 1,
        "userId": "02",
        "xp": 25,
        "username": "The02"
      });
    });
    it('Test ordering of users', async function() {
      //Add users
      await insertUsers(msg.guild.id, 20);
      await insertUsers('2', 20);
      var response = await getTops(msg, 10);
      //Check if response is correctly ordered
      //Local
      expect(response.local.length).to.equal(10);
      for (var i = 0; i < response.local.length - 1; i++) {
        expect(response.local[i].xp > response.local[i + 1].xp).to.equal(true);
      }
      //Global
      expect(response.global.length).to.equal(10);
      for (var i = 0; i < response.global.length - 1; i++) {
        expect(response.global[i].xp > response.global[i + 1].xp).to.equal(true);
      }
    });
  });
  describe('Test getUsersCount', function() {
    it('Should get users count', async function() {
      var response = await top.__get__('getUsersCount')(msg);
      expect(response.local['COUNT(userId)']).to.equal(22);
      expect(response.global['COUNT(DISTINCT userId)']).to.equal(22);
    });
  });
  describe('Execute the actual command', function() {
    it('Should return a nice embed', async function() {
      await commands.executeCmd(msg, ['top']);
      var embed = msgSend.lastCall.returnValue.content;
      //Only check for title to check if it was sent
      expect(embed.title).to.equal('__**Leaderboards:**__');
    });
  });
});
describe('Test the custom commands', function() {
  describe('Test custcmd and getCmds', function() {
    it('custcmd should return wrong usage', async function() {
      msg.content = '$custcmd';
      await commands.executeCmd(msg, ['custcmd']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.usage);
    });
    it('getCmds should return empty array', async function() {
      var response = await customCmd.getCmds(msg);
    });
    it('custcmd should add the command to the database', async function() {
      msg.content = '$custcmd testCmd1 say This is a test';
      await commands.executeCmd(msg, ['custcmd']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.custcmd.cmdAdded);
    });
    it('getCmds should return testCmd1', async function() {
      var response = await customCmd.getCmds(msg);
      expect(response).to.deep.equal([{
        action: 'say',
        arg: 'This is a test',
        name: 'testCmd1',
        serverId: '357156661105365963',
        userId: '041025599435591424',
      }]);
    })
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
    it('custcmd should add the commandd to the database when using an administrator', async function() {
      msg.content = '$custcmd testCmd2 say This is a test';
      msg.member.permissions.set('ADMINISTRATOR');
      await commands.executeCmd(msg, ['custcmd']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.custcmd.cmdAdded);
    });
    it('getCmds should return testCmd1 and testCmd2', async function() {
      var response = await customCmd.getCmds(msg);
      expect(response).to.deep.equal([{
        action: 'say',
        arg: 'This is a test',
        name: 'testCmd1',
        serverId: '357156661105365963',
        userId: '041025599435591424',
      }, {
        action: 'say',
        arg: 'This is a test',
        name: 'testCmd2',
        serverId: '357156661105365963',
        userId: '041025599435591424',
      }]);
    })
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
      var response = await customCmd.getCmds(msg);
      expect(printMsg.lastCall.returnValue).to.equal(lang.custcmdremove.cmdRemoved);
      expect(response).to.deep.equal([{
        action: 'say',
        arg: 'This is a test',
        name: 'testCmd1',
        serverId: '357156661105365963',
        userId: '041025599435591424',
      }]);
    });
  });
  describe('Test printCmds', function() {
    it('Should return info about testCmd1', async function() {
      await customCmd.printCmds(msg, ['testCmd1']);
      var embed = msgSend.lastCall.returnValue.content.embed;
      expect(embed.title).to.equal('testCmd1');
      expect(embed.fields[0].value).to.equal('say');
      expect(embed.fields[1].value).to.equal('TestUser');
      expect(embed.fields[2].value).to.equal('This is a test');
    });
    it('Should return all custom commands', async function() {
      msg.author.id = '357156661105365963';
      msg.content = '$custcmd testCmd2 say This is a test';
      await commands.executeCmd(msg, ['custcmd']);
      msg.author.id = '041025599435591424';
      await customCmd.printCmds(msg, []);
      var response = msgSend.getCall(msgSend.callCount - 2).returnValue.content;
      expect(response).to.have.string('testCmd1');
      expect(response).to.have.string('testCmd2');
    })
    it('Should return all TestUser\'s custom commands', async function() {
      msg.content = '$custcmd testCmd3 say This is a test';
      await commands.executeCmd(msg, ['custcmd']);
      await customCmd.printCmds(msg, ['']);
      var response = msgSend.getCall(msgSend.callCount - 2).returnValue.content;
      expect(response).to.have.string('testCmd1');
      expect(response).to.have.string('testCmd3');
    });
    it('Should return that the list is empty', async function() {
      msg.content = '$custcmdremove testCmd1';
      await commands.executeCmd(msg, ['custcmdremove']);
      msg.content = '$custcmdremove testCmd2';
      await commands.executeCmd(msg, ['custcmdremove']);
      msg.content = '$custcmdremove testCmd3';
      await commands.executeCmd(msg, ['custcmdremove']);
      await customCmd.printCmds(msg, ['']);
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
        disconnect: function() {}
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
      var response = await db.users.user.getWarnings(msg.guild.id, '041025599435591424');
      expect(response).to.equal(1);
    });
    it('Should decrease TestUser\'s warnings by one', async function() {
      await warnings.warn(msg, -1);
      var response = await db.users.user.getWarnings(msg.guild.id, '041025599435591424');
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
      var response = await db.users.user.getWarnings(msg.guild.id, '041025599435591424');
      expect(response).to.equal(0);
    });
    it('Should purge all', async function() {
      await warnings.warn(msg, 1);
      msg.content = '$warnpurge all';
      await commands.executeCmd(msg, ['warnpurge']);
      var response = await db.users.getWarnings(msg.guild.id);
      expect(response[0].warnings).to.equal(0);
      expect(response[1].warnings).to.equal(0);
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
      var status = rewire('../src/modules/general/status.js');
      var response;
      status.__set__('modifyText', function(path, oldStatus, newStatus) {
        response = newStatus;
      });

      msg.content = '$status New status!';
      new status().execute(msg, ['New status!']);
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
      await db.users.user.updateXP(msg.guild.id, msg.author.id, 11685);
      //Add member to groups
      await permGroups.setGroup(msg, msg.author, 'Member');
      msg.content = '$profile';
      await commands.executeCmd(msg, ['profile'])
      var embed = msgSend.lastCall.returnValue.content.embed;
      expect(embed.title).to.equal('TestUser\'s profile');
      expect(embed.fields[0].value).to.equal('Emperor ');
      expect(embed.fields[1].value).to.equal('Member, User');
      expect(embed.fields[2].value).to.exist;
      expect(embed.fields[3].value).to.exist;
      expect(embed.fields[4].value).to.equal('0');
    });
    it('Should add superuser in the groups', async function() {
      msg.content = '$profile';
      config.superusers = ['041025599435591424'];
      await commands.executeCmd(msg, ['profile']);
      var embed = msgSend.lastCall.returnValue.content.embed;
      expect(embed.fields[1].value).to.equal('Superuser, Member, User');
    });
    it('Should return George\'s profile', async function() {
      var id = '357156661105365963';
      //Add mention
      msg.mentions.users.set(id, {
        id: id,
        username: 'George'
      });
      msg.content = `$profile <#${id}>`;
      await commands.executeCmd(msg, ['profile', `<#${id}>`])
      var embed = msgSend.lastCall.returnValue.content.embed;
      expect(embed.title).to.equal('George\'s profile');
      expect(embed.fields[0].value).to.equal('Vagabond ');
      expect(embed.fields[1].value).to.equal('User');
      expect(embed.fields[2].value).to.exist;
      expect(embed.fields[3].value).to.exist;
      expect(embed.fields[4].value).to.equal('0');
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
      var response = await db.users.user.getPermGroups(msg.guild.id, '041025599435591424');
      expect(response).to.equal('User,Member,Mod');
    });
  });
  describe('unsetgroup', function() {
    it('Should remove "User" from the list of groups of TestUser', async function() {
      msg.content = '$unsetgroup <#041025599435591424> User'
      await commands.executeCmd(msg, ['unsetgroup', '<#041025599435591424>', 'User']);
      var response = await db.users.user.getPermGroups(msg.guild.id, '041025599435591424');
      expect(response).to.equal('Member,Mod');
    });
  });
  describe('purgegroups', function() {
    it('Should get TestUser back to User', async function() {
      msg.content = '$purgegroups <#041025599435591424>'
      await commands.executeCmd(msg, ['purgegroups', '<#041025599435591424>']);
      var response = await db.users.user.getPermGroups(msg.guild.id, '041025599435591424');
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

      result = separateValues(msgSend.lastCall.returnValue.content);
      expect(parseInt(result[1])).to.be.above(0);
      expect(parseInt(result[1])).to.be.below(7);
    });
    it('Should return the result of two 20 faced dice', function() {
      msg.content = '$roll 2d20';
      commands.executeCmd(msg, ['roll']);
      result = separateValues(msgSend.lastCall.returnValue.content);
      expect(parseInt(result[1])).to.be.above(0);
      expect(parseInt(result[1])).to.be.below(41);
    });
    it('Should return the result of three 12 faced dice + 5', function() {
      msg.content = '$roll 3d12+5';
      commands.executeCmd(msg, ['roll']);
      result = separateValues(msgSend.lastCall.returnValue.content);
      expect(parseInt(result[1])).to.be.above(7);
      expect(parseInt(result[1])).to.be.below(42);
    })
    it('Should return 1d6 when using wrong input', function() {
      msg.content = '$roll randomString';
      commands.executeCmd(msg, ['roll']);

      result = separateValues(msgSend.lastCall.returnValue.content);
      expect(parseInt(result[1])).to.be.above(0);
      expect(parseInt(result[1])).to.be.below(7);
    });
    it('Should return 1d6 when using no argument', function() {
      msg.content = '$roll';
      commands.executeCmd(msg, ['roll']);

      result = separateValues(msgSend.lastCall.returnValue.content);
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
});

process.on('exit', function() {
  //Make sure to delete the database at the end
  deleteDatabase();
});
