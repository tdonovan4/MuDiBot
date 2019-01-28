/*eslint no-underscore-dangle: "off"*/
const Discord = require('discord.js');
const expect = require('chai').expect;
const sinon = require('sinon');
const mustache = require('mustache');
const rewire = require('rewire');
const lang = require('../../localization/en-US.json');
const testUtil = require('../test-resources/test-util.js');
const { printMsg, msgSend, reply } = testUtil;

var config = require('../../src/util.js').getConfig()[1];
var testMessages = require('../test-resources/test-messages.js');
var msg = testMessages.msg1;

const Help = require('../../src/modules/general/help.js');
const Info = require('../../src/modules/general/info.js');
const Ping = require('../../src/modules/general/ping.js');
const Say = require('../../src/modules/general/say.js');
const Status = rewire('../../src/modules/general/status.js');

module.exports = function() {
  //Test help submodule
  describe('Test help', function() {
    var helpCmd = new Help();
    //Test args
    describe('Test arguments', function() {
      it('Should return error message when using a wrong command as an argument', function() {
        helpCmd.checkArgs(msg, ['aWrongCmd']);
        expect(printMsg.lastCall.returnValue).to.equal(lang.error.invalidArg.cmd);
      });
    });
    //Real tests
    describe('Test execute()', function() {
      it('Should return all commands', function() {
        helpCmd.execute(msg, []);
        //Not the best solution because we only check the end of the message
        var expectedString = mustache.render(lang.help.msg, {
          config
        });
        expect(msgSend.lastCall.returnValue.content).to.equal(expectedString);
      });
      it('Should return help for ping', function() {
        msg.content = '$help ping'
        helpCmd.execute(msg, ['ping']);
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
  });
  describe('Test info', function() {
    var infoCmd = new Info();
    it('Should return infos', function() {
      infoCmd.execute(msg, []);
      var embed = msgSend.lastCall.returnValue.content.embed;
      var pjson = require('../../package.json');
      //Test embed
      expect(embed.fields[0].value).to.have.string(pjson.name);
      expect(embed.fields[0].value).to.have.string(pjson.description);
      expect(embed.fields[0].value).to.have.string(pjson.author);
      expect(embed.fields[0].value).to.have.string(pjson.version);
      expect(embed.fields[1].value).to.have.string(config.locale);
      expect(embed.footer.text).to.have.string('testID');
    });
    it('Should also return infos with an argument', function() {
      infoCmd.execute(msg, ['argument']);
      var embed = msgSend.lastCall.returnValue.content.embed;
      var pjson = require('../../package.json');
      //Test embed
      expect(embed.fields[0].value).to.have.string(pjson.name);
      expect(embed.fields[0].value).to.have.string(pjson.description);
      expect(embed.fields[0].value).to.have.string(pjson.author);
      expect(embed.fields[0].value).to.have.string(pjson.version);
      expect(embed.fields[1].value).to.have.string(config.locale);
      expect(embed.footer.text).to.have.string('testID');
    });
  });
  describe('Test ping', function() {
    var pingCmd = new Ping();
    it('Should return "Pong!"', function() {
      pingCmd.execute(msg, []);
      expect(reply.lastCall.returnValue).to.equal(lang.ping.pong)
    });
    it('Should return "Pong!" with an argument', function() {
      pingCmd.execute(msg, ['argument']);
      expect(reply.lastCall.returnValue).to.equal(lang.ping.pong)
    });
  });
  describe('Test say', function() {
    var sayCmd = new Say();
    var channelSend;
    before(function() {
      msg.guild.channels.set('42', {
        send: function(msg) {
          return msg;
        }
      });
      channelSend = sinon.spy(msg.guild.channels.get('42'), 'send');
    });
    after(function() {
      msg.guild.channels.clear()
    });
    //Test args
    describe('Test arguments', function() {
      it('Should return missing argument: message', function() {
        sayCmd.checkArgs(msg, ['<#42>']);
        expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.missingArg.message);
      });
    });
    //Real tests
    describe('Test execute()', function() {
      it('Should return the message', function() {
        sayCmd.execute(msg, ['test']);
        expect(msgSend.lastCall.returnValue.content).to.equal('test');
      });
      it('Should return the message in the channel with ID 42', function() {
        sayCmd.execute(msg, ['<#42>', 'test']);
        expect(channelSend.lastCall.returnValue).to.equal('test');
      });
    });
    //Test interactiveMode
    describe('Test interactive mode', function() {
      it('Should use interactive mode to send message to current channel', async function() {
        msg.channel.messages = [
          { ...msg, ...{ content: '$skip' } },
          { ...msg, ...{ content: 'This an interactive test!' } }
        ];
        await sayCmd.interactiveMode(msg);
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
        await sayCmd.interactiveMode(msg);
        expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
          lang.say.interactiveMode.channel + ` ${lang.general.interactiveMode.optional}`);
        expect(msgSend.lastCall.returnValue.content).to.equal(
          lang.say.interactiveMode.message);
        expect(channelSend.lastCall.returnValue).to.equal('This an interactive test!');
      });
    });
  });
  describe('Test status', function() {
    var setActivity = sinon.spy(Discord.client.user, 'setActivity');
    it('Should change the status in config', function() {
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
}
