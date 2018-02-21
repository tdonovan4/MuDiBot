const expect = require('chai').expect;
const sinon = require('sinon');
const Discord = require('discord.js');
const lang = require('../localization/en-US.json');
const mustache = require('mustache');
var msg = require('./test-messages.js').msg1

//Add test values to config
require('./set-config.js').setTestConfig();
var config = require('../src/args.js').getConfig()[1];

var client = sinon.stub(Discord, 'Client');
client.returns(require('./test-client.js'));
var msgSend = sinon.spy(msg.channel, 'send')
var reply = sinon.spy(msg, 'reply')

//Init bot
const bot = require('../src/bot.js');
var setGame = sinon.spy(bot.client().user, 'setGame');
var channelSend = sinon.spy(bot.client().channels.get('42'), 'send')

//Init commands
const commands = require('../src/commands.js');
var checkPerm = sinon.stub(commands, 'checkPerm');

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
  describe('Help', function() {
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
      expect(msgSend.lastCall.returnValue).to.equal(lang.error.invalidArg.cmd);
    })
  });
  describe('Ping', function() {
    it('Should return "Pong!"', function() {
      commands.executeCmd(msg, ['ping']);
      expect(reply.lastCall.returnValue).to.equal(lang.ping.pong)
    });
  });
  describe('Info', function() {
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
  describe('Status', function() {
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
  describe('Say', function() {
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
  describe('Roll', function() {
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
});
