/*eslint no-underscore-dangle: "off"*/
const expect = require('chai').expect;
const Discord = require('discord.js');
const lang = require('../localization/en-US.json');
const mustache = require('mustache');
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

//Test the user module
const userTest = require('./unit-test/user.js');
describe('Test the user module', function() {
  userTest();
})

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
    msg.mentions.users.set('041025599435591424', {
      id: '041025599435591424'
    });
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
