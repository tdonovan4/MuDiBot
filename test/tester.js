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
const util = require('../src/util.js');
const testUtil = require('./test-resources/test-util.js');
var testMessages = require('./test-resources/test-messages.js');
var msg = testMessages.msg1;

//Add test values to config
require('./set-config.js').setTestConfig();
var config = require('../src/util.js').getConfig()[1];

//Set some stubs and spies
Discord.client = require('./test-resources/test-client.js');
var printMsg = sinon.stub(util, 'printMsg');
var { msgSend } = testUtil;
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

const db = require('../src/modules/database/database.js');
const audioPlayer = rewire('../src/modules/music/audio-player.js');
var setActivity = sinon.spy(Discord.client.user, 'setActivity');
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
})

//Test commands
const commandsTest = require('./unit-test/commands.js');
describe('Test the commands module', function() {
  commandsTest();
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
describe('Test the custom commands', function() {
  describe('Test custcmd', function() {
    //Test args
    it('custcmd should return missing action', async function() {
      await commands.executeCmd(msg, ['custcmd', 'test1']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.missingArg.action);
    });
    it('custcmd should return invalid action', async function() {
      await commands.executeCmd(msg, ['custcmd', 'test1', 'test']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.action);
    });
    it('custcmd should return missing message', async function() {
      await commands.executeCmd(msg, ['custcmd', 'test1', 'say']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.missingArg.message);
    });
    //Real tests
    it('custcmd should return too long when using a too long name', async function() {
      await commands.executeCmd(msg, ['custcmd', 'thisNameIsReallyTooLongToBeACustomCmd',
        'say', 'This', 'is', 'a', 'test'
      ]);
      expect(printMsg.lastCall.returnValue).to.equal(lang.custcmd.tooLong);
    });
    it('custcmd should add the command to the database', async function() {
      await commands.executeCmd(msg, ['custcmd', 'testCmd1', 'say',
        'This', 'is', 'a', 'test'
      ]);
      var response = await db.customCmd.getCmd(msg.guild.id, 'testCmd1');
      expect(response.name).to.equal('testCmd1');
      expect(printMsg.lastCall.returnValue).to.equal(lang.custcmd.cmdAdded);
    });
    it('custcmd should return that the command already exists', async function() {
      await commands.executeCmd(msg, ['custcmd', 'testCmd1', 'say', 'This',
        'is', 'a', 'test'
      ]);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.cmdAlreadyExists);
    });
    it('custcmd should return that the user has too many commands', async function() {
      config.custcmd.maxCmdsPerUser = 1;
      await commands.executeCmd(msg, ['custcmd', 'testCmd2', 'say', 'This',
        'is', 'a', 'test'
      ]);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.tooMuch.cmdsUser);
    });
    it('custcmd should add the command to the database when using an administrator', async function() {
      msg.member.permissions.set('ADMINISTRATOR');
      await commands.executeCmd(msg, ['custcmd', 'testCmd2', 'say', 'This',
        'is', 'a', 'test'
      ]);
      var response = await db.customCmd.getCmd(msg.guild.id, 'testCmd2');
      expect(response.name).to.equal('testCmd2');
      expect(printMsg.lastCall.returnValue).to.equal(lang.custcmd.cmdAdded);
    });
    //Test interactive mode
    it('Should use interactive mode to add a custom command', async function() {
      msg.channel.messages = [
        { ...msg, ...{ content: 'interactive' } },
        { ...msg, ...{ content: 'say' } },
        { ...msg, ...{ content: 'mode' } }
      ];
      await commands.getCmd('custcmd').interactiveMode(msg);
      expect(msgSend.getCall(msgSend.callCount - 3).returnValue.content).to.equal(
        lang.custcmd.interactiveMode.name);
      expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
        lang.custcmd.interactiveMode.action);
      expect(msgSend.lastCall.returnValue.content).to.equal(
        lang.custcmd.interactiveMode.arg);
      var response = await db.customCmd.getCmd(msg.guild.id, 'interactive');
      expect(response.name).to.equal('interactive');
    });
  });
  describe('Test removeCmd', function() {
    it('Should return command not found', async function() {
      await commands.executeCmd(msg, ['custcmdremove', 'testCmd3']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.notFound.cmd);
    });
    it('Should remove testCmd2', async function() {
      await commands.executeCmd(msg, ['custcmdremove', 'testCmd2']);
      var response = await db.customCmd.getCmd(msg.guild.id, 'testCmd2');
      expect(response).to.equal(undefined);
      expect(printMsg.lastCall.returnValue).to.equal(lang.custcmdremove.cmdRemoved);
    });
    it('Should use interactive mode to remove a custom command', async function() {
      msg.channel.messages = [
        { ...msg, ...{ content: 'interactive' } }
      ];
      await commands.getCmd('custcmdremove').interactiveMode(msg);
      expect(msgSend.lastCall.returnValue.content).to.equal(
        lang.custcmdremove.interactiveMode.command);
      var response = await db.customCmd.getCmd(msg.guild.id, 'interactive');
      expect(response).to.equal(undefined);
    });
  });
  describe('Test custcmdlist', function() {
    it('Should return info about testCmd1', async function() {
      await commands.executeCmd(msg, ['custcmdlist', 'testCmd1']);
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
      await commands.executeCmd(msg, ['custcmdlist']);
      var response = msgSend.getCall(msgSend.callCount - 2).returnValue.content;
      expect(response).to.have.string('testCmd1');
      expect(response).to.have.string('testCmd2');
    })
    it('Should return all TestUser\'s custom commands', async function() {
      //Add another custom cmd
      msg.author.id = '041025599435591424';
      await db.customCmd.insertCmd(msg.guild.id, msg.author.id, 'testCmd3', 'say', '3');
      await commands.executeCmd(msg, ['custcmdlist', '<@041025599435591424>']);
      var response = msgSend.getCall(msgSend.callCount - 2).returnValue.content;
      expect(response).to.have.string('testCmd1');
      expect(response).to.not.have.string('testCmd2');
      expect(response).to.have.string('testCmd3');
    });
    it('Should return that the list is empty', async function() {
      //Remove all inside of table
      await sql.open(config.pathDatabase);
      await sql.run('DELETE FROM custom_command');
      await sql.close();
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
  describe('help', function() {
    it('Should return all commands', function() {
      //Test args
      it('Should return error message when using a wrong command as an argument', function() {
        commands.getCmd('setgroup').checkArgs(msg, ['help', 'aWrongCmd']);
        expect(printMsg.lastCall.returnValue).to.equal(lang.error.invalidArg.cmd);
      })
      //Real tests
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
      expect(embed.title).to.equal('$ping');
      //Description
      expect(embed.fields[0].value).to.equal(lang.help.ping.msg);
      //Permission level
      expect(embed.fields[1].value).to.equal('0');
      //Usage
      expect(embed.fields[2].value).to.equal('$ping \n');
    });
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
      expect(response).to.equal('currentStatus: \'New status!');
    });
  });
  var channelSend;
  describe('say', function() {
    before(function() {
      msg.guild.channels.set('42', {
        send: function(msg) {
          return msg;
        }
      });
      channelSend = sinon.spy(msg.guild.channels.get('42'), 'send');
    });
    //Test args
    it('Should return missing argument: message', function() {
      commands.executeCmd(msg, ['say', '<#42>']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.missingArg.message);
    });
    //Real tests
    it('Should return the message', function() {
      commands.executeCmd(msg, ['say', 'test']);
      expect(msgSend.lastCall.returnValue.content).to.equal('test');
    });
    it('Should return the message in the channel with ID 42', function() {
      commands.executeCmd(msg, ['say', '<#42>', 'test']);
      expect(channelSend.lastCall.returnValue).to.equal('test');
    });
    //Test interactiveMode
    it('Should use interactive mode to send message to current channel', async function() {
      msg.channel.messages = [
        { ...msg, ...{ content: '$skip' } },
        { ...msg, ...{ content: 'This an interactive test!' } }
      ];
      await commands.getCmd('say').interactiveMode(msg);
      expect(msgSend.getCall(msgSend.callCount - 4).returnValue.content).to.equal(
        lang.say.interactiveMode.channel + ` ${lang.general.interactiveMode.optional}`);
      expect(msgSend.getCall(msgSend.callCount - 3).returnValue.content).to.equal(
        lang.general.interactiveMode.skipped);
      expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
        lang.say.interactiveMode.message);
      expect(msgSend.lastCall.returnValue.content).to.equal(
        'This an interactive test!');
    });
    it('Should use interactive mode to send message to other channel', async function() {
      msg.channel.messages = [
        { ...msg, ...{ content: '<#42>' } },
        { ...msg, ...{ content: 'This an interactive test!' } }
      ];
      await commands.getCmd('say').interactiveMode(msg);
      expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
        lang.say.interactiveMode.channel + ` ${lang.general.interactiveMode.optional}`);
      expect(msgSend.lastCall.returnValue.content).to.equal(
        lang.say.interactiveMode.message);
      expect(channelSend.lastCall.returnValue).to.equal('This an interactive test!');
    });
  });
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
  describe('gif', function() {
    it('Should return a gif', async function() {
      await new giphy.GifCommand().execute(msg, ['dog']);
      expect(msgSend.lastCall.returnValue.content).to.equal('A gif');
    });
  });
  describe('gifrandom', function() {
    it('Should return a random gif', async function() {
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
      var deletedMessages = msg.deletedMessages;
      expect(deletedMessages).to.deep.equal([]);
    });
    it('Should delete commands and messages by client', async function() {
      msg.content = '$clearlog';
      await commands.executeCmd(msg, ['clearlog']);
      var deletedMessages = msg.deletedMessages;
      expect(deletedMessages).to.deep.equal(['$ping', 'this', '$info', '$help help', 'a', '$profile']);
    })
    it('Should delete message containing "This is a test"', async function() {
      msg.mentions.users.clear();
      //Reset deletedMessages
      msg.deletedMessages = [];
      await commands.executeCmd(msg, ['clearlog', 'This', 'is', 'a', 'test', '10']);
      var deletedMessages = msg.deletedMessages;
      expect(deletedMessages).to.deep.equal(['This is a test 123']);
    })
    it('Should delete messages by user with id 384633488400140664', async function() {
      msg.mentions.users.set('384633488400140664', {
        id: '384633488400140664'
      });
      //Reset deletedMessages
      msg.deletedMessages = [];
      await commands.executeCmd(msg, ['clearlog', '<@384633488400140664>', '15']);
      var deletedMessages = msg.deletedMessages;
      expect(deletedMessages).to.deep.equal(['flower', 'pot']);
    });
    it('Should delete messages by user with id 384633488400140664 if changed nickname', async function() {
      msg.mentions.users.set('384633488400140664', {
        id: '384633488400140664'
      });
      //Reset deletedMessages
      msg.deletedMessages = [];
      await commands.executeCmd(msg, ['clearlog', '<@384633488400140664>', '15']);
      var deletedMessages = msg.deletedMessages;
      expect(deletedMessages).to.deep.equal(['flower', 'pot']);
    });
    it('Should delete message with flower by user with id 384633488400140664', async function() {
      //Reset deletedMessages
      msg.deletedMessages = [];
      await commands.executeCmd(msg, ['clearlog', '<@384633488400140664>',
        'flower', '15'
      ]);
      var deletedMessages = msg.deletedMessages;
      expect(deletedMessages).to.deep.equal(['flower']);
    });
    it('Should delete message with filters inversed', async function() {
      //Reset deletedMessages
      msg.deletedMessages = [];
      await commands.executeCmd(msg, ['clearlog', 'flower',
        '<@384633488400140664>', '15'
      ]);
      var deletedMessages = msg.deletedMessages;
      expect(deletedMessages).to.deep.equal(['flower']);
    });
  });
  describe('Test setreward', function() {
    //Test args
    it('Should return missing argument: reward', async function() {
      await commands.executeCmd(msg, ['setreward', 'farmer']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.missingArg.reward);
    });
    it('Should return rank not found', async function() {
      await commands.executeCmd(msg, ['setreward', 'test', 'member']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.notFound.rank);
    });
    it('Should return invalid reward', async function() {
      await commands.executeCmd(msg, ['setreward', 'King', 'string']);
      expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.reward);
    });
    //Real tests
    it('Should set the reward for king (permission group) and create table', async function() {
      await commands.executeCmd(msg, ['setreward', 'King', 'member']);
      var response = await db.reward.getRankReward(msg.guild.id, 'King');
      expect(response).to.equal('Member');
    });
    it('Should set the reward for emperor (role)', async function() {
      //Add roles
      msg.guild.roles.set('1', {
        id: '1'
      });
      await commands.executeCmd(msg, ['setreward', 'emperor', '<@&1>']);
      var response = await db.reward.getRankReward(msg.guild.id, 'Emperor');
      expect(response).to.equal('1');
    });
    it('Should update the reward for emperor', async function() {
      msg.guild.roles.set('2', {
        id: '2'
      });
      await commands.executeCmd(msg, ['setreward', 'emperor', '<@&2>']);
      var response = await db.reward.getRankReward(msg.guild.id, 'Emperor');
      expect(response).to.equal('2');
    });
    //Test interactive mode
    it('Should use interactive mode to modify the reward for emperor (rank)', async function() {
      msg.channel.messages = [
        { ...msg, ...{ content: 'emperor' } },
        { ...msg, ...{ content: 'Member' } }
      ];
      await commands.getCmd('setreward').interactiveMode(msg);
      expect(msgSend.getCall(msgSend.callCount - 3).returnValue.content).to.equal(
        lang.setreward.interactiveMode.rank);
      expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
        lang.setreward.interactiveMode.reward);
      expect(msgSend.lastCall.returnValue.content).to.equal(
        lang.setreward.newReward);
      var response = await db.reward.getRankReward(msg.guild.id, 'Emperor');
      expect(response).to.equal('Member');
    });
    it('Should use interactive mode to modify the reward for emperor (role)', async function() {
      msg.channel.messages = [
        { ...msg, ...{ content: 'emperor' } },
        { ...msg, ...{ content: '<@&2>' } }
      ];
      await commands.getCmd('setreward').interactiveMode(msg);
      expect(msgSend.getCall(msgSend.callCount - 3).returnValue.content).to.equal(
        lang.setreward.interactiveMode.rank);
      expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
        lang.setreward.interactiveMode.reward);
      expect(msgSend.lastCall.returnValue.content).to.equal(
        lang.setreward.newReward);
      var response = await db.reward.getRankReward(msg.guild.id, 'Emperor');
      expect(response).to.equal('2');
    });
  });
  after(function() {
    msg.guild.roles.clear();
    msg.mentions.roles.clear();
  });
});
describe('Test unsetreward', function() {
  it('Should return rank not found', async function() {
    await commands.executeCmd(msg, ['unsetreward', 'random']);
    expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.notFound.rank);
  });
  it('Should return rank reward not found', async function() {
    await commands.executeCmd(msg, ['unsetreward', 'farmer']);
    expect(printMsg.lastCall.returnValue).to.equal(lang.error.notFound.rankReward);
  });
  it('Should remove the reward for emperor', async function() {
    await commands.executeCmd(msg, ['unsetreward', 'emperor']);
    var response = await db.reward.getRankReward(msg.guild.id, 'Emperor');
    expect(response).to.equal(undefined);
  });
  it('Should use interactive mode to remove the reward for emperor', async function() {
    await commands.executeCmd(msg, ['setreward', 'emperor', 'member']);
    msg.channel.messages = [
      { ...msg, ...{ content: 'emperor' } }
    ];
    await commands.getCmd('unsetreward').interactiveMode(msg);
    expect(msgSend.lastCall.returnValue.content).to.equal(
      lang.setreward.interactiveMode.rank);
    var response = await db.reward.getRankReward(msg.guild.id, 'Emperor');
    expect(response).to.equal(undefined);
  });
});

after(async function() {
  //Make sure to delete the database at the end
  await testUtil.deleteDatabase(dbFolder);
});
