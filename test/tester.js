const expect = require('chai').expect;
const sinon = require('sinon');
const Discord = require('discord.js');
const lang = require('../localization/en-US.json');
const mustache = require('mustache');
const sql = require('sqlite');
const fs = require('fs');
const rewire = require('rewire');
const giphy = require('../src/giphy-api.js');
var testMessages = rewire('./test-resources/test-messages.js');
var msg = testMessages.msg1;

//Add test values to config
require('./set-config.js').setTestConfig();
var config = require('../src/args.js').getConfig()[1];

//Set some stubs and spies
var client = sinon.stub(Discord, 'Client');
client.returns(require('./test-resources/test-client.js'));
var msgSend = sinon.spy(msg.channel, 'send')
var reply = sinon.spy(msg, 'reply')
var search = sinon.stub(giphy, 'search');
search.resolves('A gif');
var random = sinon.stub(giphy, 'random');
random.resolves('A random gif');
const storage = require('../src/storage.js');
const levels = rewire('../src/levels.js');
const permGroups = require('../src/permission-group.js');
const warnings = require('../src/warnings.js');

//Init bot
const bot = require('../src/bot.js');

//Init stuff that need bot
const customCmd = require('../src/custom-cmd.js');
const audioPlayer = rewire('../src/audio-player.js');
var setGame = sinon.spy(bot.client().user, 'setGame');
var channelSend = sinon.spy(bot.client().channels.get('42'), 'send');
var printMsg = sinon.stub(bot, 'printMsg');
printMsg.returnsArg(1);

//Init commands
const commands = require('../src/commands.js');
var checkPerm = sinon.stub(commands, 'checkPerm');

function deleteDatabase() {
  //Delete the test database if it exists
  var path = './test/test-resources/test-database.db';
  if(fs.existsSync(path)) {
    fs.unlinkSync(path);
  }
}

describe('Test storage', function() {
  describe('Test getUser', function() {
    it('Should insert TestUser in the empty database and return it', async function() {
      //Should be deleted, but just to be sure
      deleteDatabase();
      var response = await storage.getUser(msg, '041025599435591424');
      expect(response.serverId).to.equal('357156661105365963');
      expect(response.userId).to.equal('041025599435591424');
    });
    it('Should get TestUser from the database and return it', async function() {
      var response = await storage.getUser(msg, '041025599435591424');
      expect(response.serverId).to.equal('357156661105365963');
      expect(response.userId).to.equal('041025599435591424');
    });
  });
  describe('Test getUsers', function() {
    it('Should returns an array of users in the guild', async function() {
      //Add another user. TODO: better way to add users
      storage.getUser(msg, '287350581898558262');
      var response = await storage.getUsers(msg);

      //Test the array
      expectedUserId = ['041025599435591424', '287350581898558262'];
      for(let i = 0; i < response.length; i++) {
        expect(response[i].serverId).to.equal('357156661105365963');
        expect(response[i].userId).to.equal(expectedUserId[i]);
      }
    });
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
      var response = await storage.getUser(msg, '041025599435591424');
      expect(response.groups).to.equal('User');
    });
    it('Should add "Member" to the list of groups of TestUser', async function() {
      await permGroups.setGroup(msg, msg.author, 'Member');
      var response = await storage.getUser(msg, '041025599435591424');
      expect(response.groups).to.equal('User,Member');
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
      var response = await storage.getUser(msg, '041025599435591424');
      expect(response.groups).to.equal('Member');
    });
    it('Should return that the user is not in this group', async function() {
      await permGroups.unsetGroup(msg, msg.author, 'Admin');
      expect(printMsg.lastCall.returnValue).to.equal(lang.unsetgroup.notInGroup);
    })
  });
  describe('Test purgeGroups', function() {
    it('Should return invalid user', function() {
      permGroups.purgeGroups(msg);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.invalidArg.user);
    });
    it('Should purge TestUser\'s groups', async function() {
      await permGroups.setGroup(msg, msg.author, 'User');
      msg.mentions.users.set('041025599435591424', {
        id: '041025599435591424'
      });
      await permGroups.purgeGroups(msg);
      var response = await storage.getUser(msg, '041025599435591424');
      expect(response.groups).to.equal(null);
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
    var modifyUserXp = levels.__get__('modifyUserXp');
    msg.content = 'test';
    it('User should have more than 0 XP', async function() {
      //To make sure
      await modifyUserXp(msg, '041025599435591424', 0);
      await levels.newMessage(msg);
      var user = await storage.getUser(msg, '041025599435591424');
      expect(user.xp).to.be.above(0);
    });
    it('XP should not augment if spamming', async function() {
      /*This should be executed while the XP is still
        in cooldown because of the test before */
      await modifyUserXp(msg, '041025599435591424', 0);
      for(var i = 0; i < 5; i++) {
        await levels.newMessage(msg);
      }
      var user = await storage.getUser(msg, '041025599435591424');
      expect(user.xp).to.be.equal(0);
    });
    it('Should return that the user has leveled up', async function() {
      await modifyUserXp(msg, '041025599435591424', 99);
      //Remove cooldown
      levels.__set__('lastMessages', []);
      await levels.newMessage(msg);
      expect(printMsg.lastCall.returnValue).to.equal(mustache.render(lang.general.member.leveled, {
        msg,
        progression: 2
      }));
    });
    it('Should return that the user ranked up', async function() {
      await modifyUserXp(msg, '041025599435591424', 989);
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
      await modifyUserXp(msg, '041025599435591424', 2529);
      //Remove cooldown
      levels.__set__('lastMessages', []);
      await levels.newMessage(msg);
      var response = await storage.getUser(msg, '041025599435591424');
      expect(response.groups).to.equal('Member');
    })
    it('Should set the reward for the user (role)', async function() {
      await modifyUserXp(msg, '041025599435591424', 11684);
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
describe('Test the custom commands', function() {
  describe('Test addCmd and getCmds', function() {
    it('addCmd should return wrong usage', async function() {
      await customCmd.addCmd(msg, ['']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.usage);
    });
    it('getCmds should return empty array', async function() {
      var response = await customCmd.getCmds(msg);
      expect(response).to.deep.equal([]);
    });
    it('addCmd should add the command to the database', async function() {
      await customCmd.addCmd(msg, ['testCmd1', 'say', 'This is a test']);
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
    it('addCmd should return wrong usage when using a too long name', async function() {
      await customCmd.addCmd(msg, ['thisNameIsReallyTooLongToBeACustomCmd', 'say', 'This is a test']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.usage);
    });
    it('addCmd should return that the command already exists', async function() {
      await customCmd.addCmd(msg, ['testCmd1', 'say', 'This is a test']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.cmdAlreadyExists);
    });
    it('addCmd should return that the user has too many commands', async function() {
      config.custcmd.maxCmdsPerUser = 1;
      await customCmd.addCmd(msg, ['testCmd2', 'say', 'This is a test']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.tooMuch.cmdsUser);
    });
    it('addCmd should add the commandd to the database when using an administrator', async function() {
      msg.member.permissions.set('ADMINISTRATOR');
      await customCmd.addCmd(msg, ['testCmd2', 'say', 'This is a test']);
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
      await customCmd.removeCmd(msg, ['testCmd3']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.notFound.cmd);
    });
    it('Should remove testCmd2', async function() {
      await customCmd.removeCmd(msg, ['testCmd2']);
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
      var embed = msgSend.lastCall.returnValue.embed;
      expect(embed.title).to.equal('testCmd1');
      expect(embed.fields[0].value).to.equal('say');
      expect(embed.fields[1].value).to.equal('TestUser');
      expect(embed.fields[2].value).to.equal('This is a test');
    });
    it('Should return all custom commands', async function() {
      msg.author.id = '357156661105365963';
      await customCmd.addCmd(msg, ['testCmd2', 'say', 'This is a test']);
      msg.author.id = '041025599435591424';
      await customCmd.printCmds(msg, []);
      var response = msgSend.getCall(msgSend.callCount - 2).returnValue;
      expect(response).to.have.string('testCmd1');
      expect(response).to.have.string('testCmd2');
    })
    it('Should return all TestUser\'s custom commands', async function() {
      await customCmd.addCmd(msg, ['testCmd3', 'say', 'This is a test']);
      await customCmd.printCmds(msg, ['']);
      var response = msgSend.getCall(msgSend.callCount - 2).returnValue;
      expect(response).to.have.string('testCmd1');
      expect(response).to.have.string('testCmd3');
    });
    it('Should return that the list is empty', async function() {
      await customCmd.removeCmd(msg, ['testCmd1']);
      await customCmd.removeCmd(msg, ['testCmd2']);
      await customCmd.removeCmd(msg, ['testCmd3']);
      await customCmd.printCmds(msg, ['']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.custcmdlist.empty);
    });
  });
});
describe('Test the audio player', function() {
  //TODO: Replace these placeholder tests after the rework of audio-player.
  let response;
  audioPlayer.__set__({
    addToQueue: function(msg, url) {
      response = url
    }
  });
  describe('Test playYoutube', function() {
    it('Should return wrong usage', function() {
      audioPlayer.playYoutube(msg, '');
      expect(msgSend.lastCall.returnValue).to.equal(lang.error.usage);
    });
    it('Should return missing voiceChannel', function() {
      audioPlayer.playYoutube(msg, ['pet']);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.notFound.voiceChannel);
    });
    it('Should execute addToQueue with the url', function() {
      msg.member.voiceChannel = 'Not null';
      audioPlayer.playYoutube(msg, ['https://www.youtube.com/watch?v=jNQXAC9IVRw']);
      expect(response).to.equal('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    });
  });
  describe('Test stop', function() {
    it('Should call voiceConnection.disconnect()', function() {
      audioPlayer.__set__({
        voiceConnection: {
          disconnect: function(msg) {
            response = 'disconnected';
          }
        }
      });
      audioPlayer.stop(msg);
      expect(response).to.equal('disconnected');
      expect(printMsg.lastCall.returnValue).to.equal(lang.play.disconnected);
    });
  });
  describe('Test skip', function() {
    it('Should destroy the dispatcherStream', function() {
      msg.member.voiceChannel = {
        connection: {
          player: {
            dispatcher: {
              stream: {
                destroy: function() {
                  response = 'destroyed';
                }
              }
            }
          }
        }
      }
      audioPlayer.skip(msg);
      expect(response).to.equal('destroyed');
      expect(printMsg.lastCall.returnValue).to.equal(lang.play.skipped);
    });
  });
  describe('Test listQueue', function() {
    it('Should send empty queue', function() {
      audioPlayer.listQueue(msg);
      expect(msgSend.lastCall.returnValue).to.equal(lang.play.queue);
    });
    it('Should send a list containing the videos in queue', function() {
      //Set the videos
      audioPlayer.__set__({
        queue: [[0, 'dog'], [1, 'cat']]
      });
      audioPlayer.listQueue(msg);
      expect(msgSend.lastCall.returnValue).to.equal(
        lang.play.queue + '\n "dog"\n "cat"'
      );
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
      var response = await storage.getUser(msg, '041025599435591424');
      expect(response.warnings).to.equal(1);
    });
    it('Should decrease TestUser\'s warnings by one', async function() {
      await warnings.warn(msg, -1);
      var response = await storage.getUser(msg, '041025599435591424');
      expect(response.warnings).to.equal(0);
    });
  });
  describe('Test list', function() {
    it('Should return wrong usage', function() {
      msg.mentions.users.clear();
      msg.content = '$warnlist';
      warnings.list(msg);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.usage);
    });
    it('Should return no warnings', async function() {
      msg.content = '$warnlist all';
      await warnings.list(msg);
      expect(printMsg.lastCall.returnValue).to.equal(lang.warn.noWarns);
    });
    it('Should return all warnings', async function() {
      //Add warnings to users
      msg.mentions.users.set('357156661105365963', {
        id: '357156661105365963'
      });
      await warnings.warn(msg, 3);
      msg.mentions.users.clear();

      msg.mentions.users.set('041025599435591424', {
        id: '041025599435591424'
      });
      await warnings.warn(msg, 2);

      msg.content = '$warnlist all';
      await warnings.list(msg);
      expect(printMsg.lastCall.returnValue).to.equal(
        '<@041025599435591424>: 2 warnings\n<@357156661105365963>: 3 warnings');
    });
    it('Should return TestUser\'s warnings', async function() {
      msg.content = '$warnlist';
      await warnings.list(msg);
      expect(printMsg.lastCall.returnValue).to.equal('<@041025599435591424>: 2 warnings');
    });
  });
  describe('Test purge', function() {
    it('Should return wrong usage', function() {
      msg.mentions.users.clear();
      msg.content = '$warnpurge';
      warnings.purge(msg);
      expect(printMsg.lastCall.returnValue).to.equal(lang.error.usage);
    });
    it('Should purge TestUser', async function() {
      msg.mentions.users.set('041025599435591424', {
        id: '041025599435591424'
      });
      msg.content = '$warnpurge';
      await warnings.purge(msg);
      var response = await storage.getUser(msg, '041025599435591424');
      expect(response.warnings).to.equal(0);
    });
    it('Should purge all', async function() {
      await warnings.warn(msg, 1);
      msg.content = '$warnpurge all';
      await warnings.purge(msg);
      var response = await storage.getUsers(msg);
      expect(response[0].warnings).to.equal(0);
      expect(response[1].warnings).to.equal(0);
    });
  });
});
describe('Validate if message is a command', function() {
  it('Should return false when using a false command', async function() {
    //Change content of message
    msg.content = 'randomString';
    var response = await commands.checkIfValidCmd(msg, ['randomString']);
    expect(response).to.equal(false);
  });
  before(function() {
    checkPerm.resolves(true);
  });
  it('Should return true when using a real command', async function() {
    msg.content = '$help';
    var response = await commands.checkIfValidCmd(msg, ['help']);
    expect(response).to.equal(true);
  })
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
      expect(msgSend.lastCall.returnValue).to.equal(expectedString);
    });
    it('Should return help for ping', function() {
      msg.content = '$help ping'
      commands.executeCmd(msg, ['help', 'ping']);
      var embed = msgSend.lastCall.returnValue.embed;
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
      var embed = msgSend.lastCall.returnValue.embed;
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
      var modifyText = sinon.stub(commands, 'modifyText');

      msg.content = '$status New status!';
      commands.executeCmd(msg, ['status', 'New status!']);
      //Check the API has been called with right argument
      expect(setGame.lastCall.returnValue).to.equal('New status!');
      //Check if config was "modified" (stub) with righ argument
      //TODO: Better expect here
      expect(modifyText.lastCall.args[2]).to.equal("currentStatus: 'New status!");
    });
  });
  describe('say', function() {
    it('Should return the message', function() {
      msg.content = '$say here test';
      commands.executeCmd(msg, ['say', 'here', 'test']);
      expect(msgSend.lastCall.returnValue).to.equal('test');
    });
    it('Should return missing argument: channel', function() {
      msg.content = '$say test';
      commands.executeCmd(msg, ['say', 'test']);
      expect(msgSend.lastCall.returnValue).to.equal(lang.error.missingArg.channel);
    });
    it('Should return the message in the channel with ID 42', function() {
      msg.content = '$say <#42> test';
      commands.executeCmd(msg, ['say', '<#42>', 'test']);
      expect(channelSend.lastCall.returnValue).to.equal('test');
    });
    it('Should return missing argument: channel when using wrong channel', function() {
      msg.content = '$say badString test';
      commands.executeCmd(msg, ['say', 'badString', 'test']);
      expect(msgSend.lastCall.returnValue).to.equal(lang.error.missingArg.channel);
    });
    it('Should return missing argument: message', function() {
      msg.content = '$say here';
      commands.executeCmd(msg, ['say', 'here']);
      expect(msgSend.lastCall.returnValue).to.equal(lang.error.missingArg.message);
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
      msg.content = '$profile';
      await commands.executeCmd(msg, ['profile'])
      var embed = msgSend.lastCall.returnValue.embed;
      expect(embed.title).to.equal('TestUser\'s profile');
      expect(embed.fields[0].value).to.equal('Emperor ');
      expect(embed.fields[1].value).to.equal('Member');
      expect(embed.fields[2].value).to.exist;
      expect(embed.fields[3].value).to.exist;
      expect(embed.fields[4].value).to.equal('0');
    });
    it('Should add superuser in the groups', async function() {
      msg.content = '$profile';
      config.superusers = ['041025599435591424'];
      await commands.executeCmd(msg, ['profile']);
      var embed = msgSend.lastCall.returnValue.embed;
      expect(embed.fields[1].value).to.equal('Superuser, Member');
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
      var embed = msgSend.lastCall.returnValue.embed;
      expect(embed.title).to.equal('George\'s profile');
      expect(embed.fields[0].value).to.equal('Vagabond ');
      expect(embed.fields[1].value).to.equal('Ø');
      expect(embed.fields[2].value).to.exist;
      expect(embed.fields[3].value).to.exist;
      expect(embed.fields[4].value).to.equal('0');
    });
  });
  describe('setgroup', function() {
    it('Should add "User" to the list of groups of TestUser', async function() {
      msg.mentions.users.clear();
      msg.mentions.users.set('041025599435591424', {
        id: '041025599435591424'
      });
      msg.content = '$setgroup <#041025599435591424> User'
      await commands.executeCmd(msg, ['setgroup', '<#041025599435591424>', 'User']);
      var response = await storage.getUser(msg, '041025599435591424');
      expect(response.groups).to.equal('Member,User');
    });
  });
  describe('unsetgroup', function() {
    it('Should remove "User" from the list of groups of TestUser', async function() {
      msg.content = '$unsetgroup <#041025599435591424> User'
      await commands.executeCmd(msg, ['unsetgroup', '<#041025599435591424>', 'User']);
      var response = await storage.getUser(msg, '041025599435591424');
      expect(response.groups).to.equal('Member');
    });
  });
  describe('purgegroups', function() {
    it('Should remove all groups from TestUser', async function() {
      msg.content = '$purgegroups <#041025599435591424>'
      await commands.executeCmd(msg, ['purgegroups', '<#041025599435591424>']);
      var response = await storage.getUser(msg, '041025599435591424');
      expect(response.groups).to.equal(null);
    });
  });
  describe('gif', function() {
    it('Should return a gif', async function() {
      msg.content = '$gif dog';
      await commands.executeCmd(msg, ['gif', 'dog']);
      expect(msgSend.lastCall.returnValue).to.equal('A gif');
    });
  });
  describe('gifrandom', function() {
    it('Should return a random gif', async function() {
      msg.content = '$gifrandom dog';
      await commands.executeCmd(msg, ['gifrandom', 'dog']);
      expect(msgSend.lastCall.returnValue).to.equal('A random gif');
    })
  });
  describe('flipcoin', function() {
    it('Should return head or tail', function() {
      commands.executeCmd(msg, ['flipcoin']);
      expect(reply.lastCall.returnValue).to.be.oneOf(['heads', 'tails']);
    });
  });
  describe('roll', function() {
    it('Should return the result of one six faced die', function() {
      msg.content = '$roll 1d6';
      commands.executeCmd(msg, ['roll', '1d6']);

      result = parseInt(reply.lastCall.returnValue);
      expect(result).to.be.above(0);
      expect(result).to.be.below(7);
    });
    it('Should return the result of two 20 faced dice', function() {
      msg.content = '$roll 2d20';
      commands.executeCmd(msg, ['roll', '2d20']);
      result = parseInt(reply.lastCall.returnValue);
      expect(result).to.be.above(0);
      expect(result).to.be.below(41);
    });
    it('Should return the result of three 12 faced dice + 5', function() {
      msg.content = '$roll 3d12+5';
      commands.executeCmd(msg, ['roll', '3d12+5']);
      result = parseInt(reply.lastCall.returnValue);
      expect(result).to.be.above(4);
      expect(result).to.be.below(42);
    })
    it('Should return 0 when using wrong input', function() {
      msg.content = '$roll randomString';
      commands.executeCmd(msg, ['roll', 'randomString']);
      result = parseInt(reply.lastCall.returnValue);
      expect(result).to.equal(0);
    });
  });
  describe('clearlog' , function() {
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
  });
});

process.on('exit', function() {
  //Make sure to delete the database at the end
  deleteDatabase();
});
