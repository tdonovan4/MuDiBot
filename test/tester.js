/*eslint no-underscore-dangle: "off"*/
const expect = require('chai').expect;
const Discord = require('discord.js');
const lang = require('../localization/en-US.json');
const mustache = require('mustache');
const sql = require('sqlite');
const fs = require('fs');
const rewire = require('rewire');
const testUtil = require('./test-resources/test-util.js');
var testMessages = require('./test-resources/test-messages.js');
var msg = testMessages.msg1;

//Add test values to config
require('./set-config.js').setTestConfig();
var config = require('../src/util.js').getConfig()[1];

//Set some stubs and spies
Discord.client = require('./test-resources/test-client.js');
var { printMsg, msgSend } = testUtil;

const levels = rewire('../src/levels.js');
const permGroups = rewire('../src/modules/user/permission-group.js');
const warnings = require('../src/modules/warnings/warnings.js');

const db = require('../src/modules/database/database.js');
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

//Test database
const dbTest = require('./unit-test/database.js');
describe('Test the database module', function() {
  dbTest();
});

//Test commands
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
})

//Test the music module
const musicTest = require('./unit-test/music.js');
describe('Test the music module', function() {
  musicTest();
})

describe('Test permission groups', function() {
  describe('Test setGroup', function() {
    //Test Args
    it('Should return invalid user', function() {
      commands.getCmd('setgroup').checkArgs(msg, ['test']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.user);
    });
    it('Should return missing argument: group', function() {
      commands.getCmd('setgroup').checkArgs(msg, ['<@1>']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.missingArg.group);
    });
    it('Should return group not found', function() {
      commands.getCmd('setgroup').checkArgs(msg, ['<@1>', 'qwerty']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.notFound.group);
    });
    //Real tests
    it('Should add "User" to the list of groups of TestUser', async function() {
      await permGroups.setGroup(msg, msg.author, 'User');
      var response = await db.user.getPermGroups(msg.guild.id, msg.author.id);
      expect(response).to.equal('User');
    });
    it('Should add "Member" to the list of groups of TestUser', async function() {
      await permGroups.setGroup(msg, msg.author, 'Member');
      var response = await db.user.getPermGroups(msg.guild.id, msg.author.id);
      expect(response).to.equal('User,Member');
    });
    //Test interactive mode
    it('Should use interactive mode to add "Mod" to TestUser', async function() {
      msg.channel.messages = [
        { ...msg, ...{ content: `<@${msg.author.id}>` } },
        { ...msg, ...{ content: 'Mod' } }
      ];
      await commands.getCmd('setgroup').interactiveMode(msg);
      expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
        lang.setgroup.interactiveMode.user);
      expect(msgSend.lastCall.returnValue.content).to.equal(
        lang.setgroup.interactiveMode.group);
      var response = await db.user.getPermGroups(msg.guild.id, msg.author.id);
      expect(response).to.equal('User,Member,Mod');
    });
  });
  describe('Test unsetGroup', function() {
    //Test args
    it('Should return invalid user', function() {
      commands.getCmd('unsetgroup').checkArgs(msg, ['test']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.user);
    });
    it('Should return missing argument: group', function() {
      commands.getCmd('unsetgroup').checkArgs(msg, ['<@1>']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.missingArg.group);
    });
    it('Should return group not found', function() {
      commands.getCmd('unsetgroup').checkArgs(msg, ['<@1>', 'qwerty']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.notFound.group);
    });
    //Real tests
    it('Should remove "User" from the list of groups of TestUser', async function() {
      await permGroups.unsetGroup(msg, msg.author, 'User');
      var response = await db.user.getPermGroups(msg.guild.id, '041025599435591424');
      expect(response).to.equal('Member,Mod');
    });
    it('Should return that the user is not in this group', async function() {
      await permGroups.unsetGroup(msg, msg.author, 'Admin');
      expect(printMsg.lastCall.returnValue).to.equal(lang.unsetgroup.notInGroup);
    })
    //Test interactive mode
    it('Should use interactive mode to remove "Mod" from TestUser', async function() {
      msg.channel.messages = [
        { ...msg, ...{ content: `<@${msg.author.id}>` } },
        { ...msg, ...{ content: 'Mod' } }
      ];
      await commands.getCmd('unsetgroup').interactiveMode(msg);
      expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
        lang.setgroup.interactiveMode.user);
      expect(msgSend.lastCall.returnValue.content).to.equal(
        lang.setgroup.interactiveMode.group);
    });
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
      var response = await db.user.getPermGroups(msg.guild.id, msg.author.id);
      expect(response).to.equal('User');
    })
    //Test interactive mode
    it('Should use interactive mode to purge TestUser\'s groups', async function() {
      await permGroups.setGroup(msg, msg.author, 'Mod');
      msg.channel.messages = [
        { ...msg, ...{ content: `<@${msg.author.id}>` } }
      ];
      await commands.getCmd('purgegroups').interactiveMode(msg);
      expect(msgSend.lastCall.returnValue.content).to.equal(
        lang.setgroup.interactiveMode.user);
      var response = await db.user.getPermGroups(msg.guild.id, msg.author.id);
      expect(response).to.equal('User');
    });
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
  await sql.run('INSERT INTO user (server_id, user_id, xp, warning, permission_group) VALUES (?, ?, ?, ?, ?)', [serverId, userId, xp, 0, null]);
  await sql.close();
  //Add user to collection
  Discord.client.users.set(`${userId}`, {
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
    Discord.client.users.set(`${i}`, {
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
describe('Test warnings', function() {
  describe('Test warn', function() {
    it('Should return invalid user', function() {
      commands.getCmd('warn').checkArgs(msg, ['test']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.user);
    });
    it('Should increase TestUser\'s warnings by one', async function() {
      await warnings.warn(msg, msg.author, 1);
      var response = await db.user.getWarnings(msg.guild.id, msg.author.id);
      expect(response).to.equal(1);
    });
    it('Should decrease TestUser\'s warnings by one', async function() {
      await warnings.warn(msg, msg.author, -1);
      var response = await db.user.getWarnings(msg.guild.id, msg.author.id);
      expect(response).to.equal(0);
    });
    it('Should use interactive mode to warn user', async function() {
      msg.channel.messages = [
        { ...msg, ...{ content: `<@${msg.author.id}>` } },
      ];
      await commands.getCmd('warn').interactiveMode(msg);
      expect(msgSend.lastCall.returnValue.content).to.equal(
        lang.warn.interactiveMode.user);
      var response = await db.user.getWarnings(msg.guild.id, msg.author.id);
      expect(response).to.equal(1);
    });
    it('Should use interactive mode to unwarn user', async function() {
      msg.channel.messages = [
        { ...msg, ...{ content: `<@${msg.author.id}>` } },
      ];
      await commands.getCmd('unwarn').interactiveMode(msg);
      expect(msgSend.lastCall.returnValue.content).to.equal(
        lang.warn.interactiveMode.user);
      var response = await db.user.getWarnings(msg.guild.id, msg.author.id);
      expect(response).to.equal(0);
    });
  });
});
describe('Test list', function() {
  it('Should return no warnings', async function() {
    await commands.executeCmd(msg, ['warnlist']);
    expect(printMsg.lastCall.returnValue).to.equal(lang.warn.noWarns);
  });
  it('Should return all warnings', async function() {
    //Add warnings to users
    await warnings.warn(msg, { id: '357156661105365963' }, 3);
    await warnings.warn(msg, msg.author, 2);
    //Real test
    await commands.executeCmd(msg, ['warnlist']);
    expect(printMsg.lastCall.returnValue).to.equal(
      '<@041025599435591424>: 2 warnings\n<@357156661105365963>: 3 warnings');
  });
  it('Should return TestUser\'s warnings', async function() {
    await commands.executeCmd(msg, ['warnlist', '<@041025599435591424>']);
    expect(printMsg.lastCall.returnValue).to.equal('<@041025599435591424>: 2 warnings');
  });
});
describe('Test purge', function() {
  //Test args
  it('Should return invalid user', function() {
    commands.getCmd('warnpurge').checkArgs(msg, ['test']);
    expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.user);
  });
  //Real tests
  it('Should purge TestUser', async function() {
    await commands.executeCmd(msg, ['warnpurge', `<@${msg.author.id}>`]);
    var response = await db.user.getWarnings(msg.guild.id, msg.author.id);
    expect(response).to.equal(0);
  });
  it('Should purge all', async function() {
    await warnings.warn(msg, '357156661105365963', 1);
    await commands.executeCmd(msg, ['warnpurge', 'all']);
    var response = await db.user.getUsersWarnings(msg.guild.id);
    expect(response[0].warning).to.equal(0);
    expect(response[1].warning).to.equal(0);
  });
  //Test interactive mode
  it('Should use interactive mode to purge user', async function() {
    await warnings.warn(msg, msg.author.id, 1);
    msg.channel.messages = [
      { ...msg, ...{ content: `$skip` } },
      { ...msg, ...{ content: `<@${msg.author.id}>` } }
    ];
    await commands.getCmd('warnpurge').interactiveMode(msg);
    expect(msgSend.getCall(msgSend.callCount - 3).returnValue.content).to.equal(
      lang.warn.interactiveMode.all + ` ${lang.general.interactiveMode.optional}`);
    expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
      lang.general.interactiveMode.skipped);
    expect(msgSend.lastCall.returnValue.content).to.equal(
      lang.warn.interactiveMode.user);
    var response = await db.user.getWarnings(msg.guild.id, msg.author.id);
    expect(response).to.equal(0);
  });
  it('Should use interactive mode to purge all', async function() {
    await warnings.warn(msg, '357156661105365963', 1);
    await warnings.warn(msg, msg.author.id, 1);
    msg.channel.messages = [
      { ...msg, ...{ content: `all` } },
    ];
    await commands.getCmd('warnpurge').interactiveMode(msg);
    expect(msgSend.lastCall.returnValue.content).to.equal(
      lang.warn.interactiveMode.all + ` ${lang.general.interactiveMode.optional}`);
    var response = await db.user.getWarnings(msg.guild.id, '357156661105365963');
    expect(response).to.equal(0);
  });
});
describe('Test commands', function() {
  var url = 'https://cdn.discordapp.com/avatars/041025599435591424/';
  describe('avatar', function() {
    //Test args
    it('Should return invalid arg: user', function() {
      commands.getCmd('avatar').checkArgs(msg, ['test']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.user);
    });
    //Actual tests
    it('Should return TestUser\'s avatar', function() {
      //Add mention
      commands.executeCmd(msg, ['avatar', `<@${msg.author.id}>`]);
      expect(msgSend.lastCall.returnValue.content).to.equal(url);
    });
    //Test interactive mode
    it('Should use interactive mode to get TestUser\'s avatar', async function() {
      msg.channel.messages = [
        { ...msg, ...{ content: `<@${msg.author.id}>` } }
      ];
      await commands.getCmd('avatar').interactiveMode(msg);
      expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
        lang.avatar.interactiveMode.user);
      expect(msgSend.lastCall.returnValue.content).to.equal(url);
    });
  });
  describe('profile', function() {
    it('Should return the message author\'s (TestUser) profile', async function() {
      msg.mentions.users.set(msg.author.id, msg.author);
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
        'have a bio!```\n**Birthday:** Unknown | **Location:** Unknown\n' +
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
        '**Birthday:** --02-01 | **Location:** There\n' +
        '**Account created since:** 2009-12-24');
    });
    it('Should return George\'s profile', async function() {
      msg.mentions.users.clear();
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
        'have a bio!```\n**Birthday:** Unknown | **Location:** Unknown\n' +
        '**Account created since:** 1985-11-16');
      expect(embed.fields[1].value).to.equal('Rank: Vagabond\n' +
        'Position: #27\nLevel: 1 (0/100)\nTotal XP: 0');
      expect(embed.fields[2].value).to.equal('Rank: Vagabond\n' +
        'Position: #25\nLevel: 1 (0/100)\nTotal XP: 0');
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
      it('Should return invalid field', async function() {
        await commands.executeCmd(msg, ['modifyprofile', 'test']);
        var result = msgSend.lastCall.returnValue.content;
        expect(result).to.equal(lang.error.invalidArg.field);
      });
      it('Should return missing argument value', async function() {
        await commands.executeCmd(msg, ['modifyprofile', 'bio']);
        var result = msgSend.lastCall.returnValue.content;
        expect(result).to.equal(lang.error.missingArg.value);
      });
      it('Should return invalid argument field', async function() {
        await commands.executeCmd(msg, ['modifyprofile', 'test', 'test']);
        var result = msgSend.lastCall.returnValue.content;
        expect(result).to.equal(lang.error.invalidArg.field);
      });
    });
    describe('Test validation of input', function() {
      it('The bio field should return that there is too much chars', async function() {
        var args = ('modifyprofile bio Lorem ipsum dolor sit amet, ' +
          'nostrud civibus mel ne, eu sea nostrud epicurei urbanitas, ' +
          'eam ex sonet repudiare. Ex debet tation cum, ex qui graeci ' +
          'senserit definiebas, sint dolorem definitionem eam ne. ' +
          'Eum doctus impedit prodesset ad, habeo justo dicunt te est. ' +
          'Vel eruditi eligendi imperdiet et, mea no dolor propriae deseruisse. ' +
          'Reque populo maluisset ne has, has decore ullamcorper ad, ' +
          'commodo iracundia ea nec.').split(' ');
        await commands.executeCmd(msg, args);
        var result = msgSend.lastCall.returnValue.content;
        var response = await db.user.getAll(msg.guild.id, msg.author.id);
        expect(result).to.equal(mustache.render(lang.error.tooMuch.chars, {
          max: 280
        }));
        //Make sure the db was not modified
        expect(response.bio).to.equal(null);
      });
      it('The birthday field should return that the format is wrong', async function() {
        await commands.executeCmd(msg, ['modifyprofile', 'birthday', 'test']);
        var result = msgSend.lastCall.returnValue.content;
        var response = await db.user.getAll(msg.guild.id, msg.author.id);
        expect(result).to.equal(lang.error.formatError);
        //Make sure the db was not modified
        expect(response.birthday).to.equal(null);
      });
    });
    describe('Test if the command actually works', function() {
      it('Should change bio to lorem ipsum', async function() {
        await commands.executeCmd(msg, ['modifyprofile', 'bio', 'lorem', 'ipsum']);
        var response = await db.user.getAll(msg.guild.id, msg.author.id);
        expect(response.bio).to.equal('lorem ipsum');
      });
      it('Should change birthday to 1971-01-01', async function() {
        await commands.executeCmd(msg, ['modifyprofile', 'birthday', '1971-01-01']);
        var response = await db.user.getAll(msg.guild.id, msg.author.id);
        expect(response.birthday).to.equal('1971-01-01');
      });
      it('Should change location to there', async function() {
        await commands.executeCmd(msg, ['modifyprofile', 'location', 'there']);
        var response = await db.user.getAll(msg.guild.id, msg.author.id);
        expect(response.location).to.equal('there');
      });
    });
    describe('Test interactive mode', function() {
      it('Should use interactive mode to change location to somewhere', async function() {
        msg.channel.messages = [
          { ...msg, ...{ content: 'location' } },
          { ...msg, ...{ content: 'somewhere' } }
        ];
        await commands.getCmd('modifyprofile').interactiveMode(msg);
        expect(msgSend.getCall(msgSend.callCount - 3).returnValue.content).to.equal(
          lang.modifyprofile.interactiveMode.field);
        expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
          lang.modifyprofile.interactiveMode.value);
        expect(msgSend.lastCall.returnValue.content).to.equal(
          lang.modifyprofile.modified);
        var response = await db.user.getAll(msg.guild.id, msg.author.id);
        expect(response.location).to.equal('somewhere');
      });
    });
  });
  describe('setgroup', function() {
    it('Should add "Mod" to the list of groups of TestUser', async function() {
      msg.mentions.users.clear();
      msg.mentions.users.set('041025599435591424', {
        id: '041025599435591424'
      });
      await commands.executeCmd(msg, ['setgroup', '<@041025599435591424>', 'Mod']);
      var response = await db.user.getPermGroups(msg.guild.id, '041025599435591424');
      expect(response).to.equal('User,Member,Mod');
    });
  });
  describe('unsetgroup', function() {
    it('Should remove "User" from the list of groups of TestUser', async function() {
      await commands.executeCmd(msg, ['unsetgroup', '<@041025599435591424>', 'User']);
      var response = await db.user.getPermGroups(msg.guild.id, '041025599435591424');
      expect(response).to.equal('Member,Mod');
    });
  });
  describe('purgegroups', function() {
    it('Should get TestUser back to User', async function() {
      await commands.executeCmd(msg, ['purgegroups', '<@041025599435591424>']);
      var response = await db.user.getPermGroups(msg.guild.id, '041025599435591424');
      expect(response).to.equal('User');
    });
  });
});

after(async function() {
  //Make sure to delete the database at the end
  await testUtil.deleteDatabase(dbFolder);
});
