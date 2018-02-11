const expect = require('chai').expect;
const sinon = require('sinon');
const Discord = require('discord.js');
const client = new Discord.Client();
const bot = require('../src/bot.js');
const commands = require('../src/commands.js');
const lang = require('../localization/en-US.json');
var config = require('../src/args.js').getConfig();
var msg = require('./test-messages.js').msg1

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
  describe('Ping', function() {
    it('Should return "Pong!"', function() {
      var reply = sinon.spy(msg, 'reply')

      commands.executeCmd(msg, ['ping']);
      expect(reply.firstCall.returnValue).to.equal(lang.ping.pong)
    });
  });
});
