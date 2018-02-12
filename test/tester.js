const expect = require('chai').expect;
const sinon = require('sinon');
const Discord = require('discord.js');
const client = new Discord.Client();
const bot = require('../src/bot.js');
const commands = require('../src/commands.js');
const lang = require('../localization/en-US.json');
const mustache = require('mustache');
var config = require('../src/args.js').getConfig();
var msg = require('./test-messages.js').msg1

var send = sinon.spy(msg.channel, 'send')

describe('Test commands', function() {
  describe('Execute command', function() {
    it('Should return false when using a false command', async function() {
      //Change content of message
      msg.content = 'randomString';
      var response = await commands.checkIfValidCmd(msg, ['randomString']);
      expect(response).to.equal(false);
    });
    before(function() {
      var stub = sinon.stub(commands, 'checkPerm');
      stub.resolves(true);
    });
    it('Should return true when using a real command', async function() {
      msg.content = '$help';
      var response = await commands.checkIfValidCmd(msg, ['help']);
      expect(response).to.equal(true);
    })
  });
  describe('Help', function() {
    it('Should return all commands', function() {
      commands.executeCmd(msg, ['help']);
      //Not the best solution because we only check the end of the message
      var expectedString = mustache.render(lang.help.msg, {
        config
      });
      expect(send.lastCall.returnValue).to.equal(expectedString);
    });
    it('Should return help for ping', function() {
      msg.content = '$help ping'
      commands.executeCmd(msg, ['help', 'ping']);
      var embed = send.lastCall.returnValue.embed;
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
      expect(send.lastCall.returnValue).to.equal(lang.error.invalidArg.cmd);
    })
  });
  describe('Ping', function() {
    it('Should return "Pong!"', function() {
      var reply = sinon.spy(msg, 'reply')
      commands.executeCmd(msg, ['ping']);
      expect(reply.firstCall.returnValue).to.equal(lang.ping.pong)
    });
  });
});
