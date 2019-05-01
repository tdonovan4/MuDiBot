/*eslint no-underscore-dangle: "off"*/
const Discord = require('discord.js');
const expect = require('chai').expect;
const sinon = require('sinon');
const mustache = require('mustache');
const rewire = require('rewire');
const db = require('../../src/modules/database/database.js');
const lang = require('../../localization/en-US.json');
const testUtil = require('../test-resources/test-util.js');
const { replaceDatabase, msgSend, reply } = testUtil;

var config = require('../../src/util.js').getConfig()[1];
var testMessages = require('../test-resources/test-messages.js');
var msg = testMessages.msg1;

const Help = require('../../src/modules/general/help.js');
const Info = require('../../src/modules/general/info.js');
const notification = require('../../src/modules/general/notification.js');
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
        expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.cmd);
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
  describe('Test notification', function() {
    describe('Test birthdays', function() {
      var clock;
      var channel1;
      var channel2;
      var channel3;
      beforeEach(async function() {
        await replaceDatabase(config.pathDatabase, 'data2.db');
        //Set the guilds
        var guilds = Discord.client.guilds;
        class TestGuild {
          constructor(id, members) {
            this.id = id;
            this.members = members
          }
        }
        guilds.set('1', new TestGuild('1', new Map([
          ['2', { id: 2 }],
          ['3', { id: 3 }],
          ['4', { id: 4 }]
        ])));
        guilds.set('2', new TestGuild('2', new Map([
          ['1', { id: 1 }],
          ['2', { id: 2 }]
        ])));
        guilds.set('3', new TestGuild('3', new Map([
          ['3', { id: 3 }]
        ])));
        //Set the channels
        class TestChannel {
          constructor(id) {
            this.id = id;
          }
          send(msg) {
            return msg;
          }
        }
        var channels = Discord.client.channels;
        channels.set('1', new TestChannel('1'));
        channels.set('2', new TestChannel('2'));
        channels.set('3', new TestChannel('3'));
        //Stub the channels
        channel1 = sinon.stub(channels.get('1'), 'send');
        channel2 = sinon.stub(channels.get('2'), 'send');
        channel3 = sinon.stub(channels.get('3'), 'send');
      });
      afterEach(function() {
        //Cleanup
        clock.restore();
        Discord.client.guilds.clear();
        Discord.client.channels.clear();
      });
      //Start testing
      it('Should print the users with a birthday the 5 April', async function() {
        //Set date to 5 April
        clock = sinon.useFakeTimers(1491393600000);
        await notification.birthdays.job();
        expect(channel1.lastCall.lastArg).to.equal('Happy birthday, <@2>!');
        expect(channel2.lastCall.lastArg).to.equal('Happy birthday to: <@1>, <@2>!');
        expect(channel3.called).to.be.false;
      });
      it('Should print the users with a birthday the 7 April', async function() {
        //Set date to 7 April
        clock = sinon.useFakeTimers(1491566400000);
        await notification.birthdays.job();
        expect(channel1.lastCall.lastArg).to.equal('Happy birthday, <@4>!');
        expect(channel2.called).to.be.false;
        expect(channel3.lastCall.lastArg).to.equal('Happy birthday, <@3>!');
      });
      it('Should print special message for the bot anniversary', async function() {
        //Set date to 6 April
        clock = sinon.useFakeTimers(1554552000000);
        await notification.birthdays.job();
        var specialMsg = 'Happy birthday to me! I\'m now 2 years old!';
        expect(channel1.lastCall.lastArg).to.equal(specialMsg);
        expect(channel2.lastCall.lastArg).to.equal(specialMsg);
        expect(channel3.lastCall.lastArg).to.equal(specialMsg);
      });
      it('Should not use broken guild id', async function() {
        Discord.client.guilds.delete('1');
        //Set date to 5 April
        clock = sinon.useFakeTimers(1491393600000);
        await notification.birthdays.job();
        expect(channel1.called).to.be.false;
        expect(channel2.lastCall.lastArg).to.equal('Happy birthday to: <@1>, <@2>!');
        expect(channel3.called).to.be.false;
      });
      it('Should not mention users who left', async function() {
        Discord.client.guilds.get('2').members.delete('2');
        //Set date to 5 April
        clock = sinon.useFakeTimers(1491393600000);
        await notification.birthdays.job();
        expect(channel1.lastCall.lastArg).to.equal('Happy birthday, <@2>!');
        expect(channel2.lastCall.lastArg).to.equal('Happy birthday, <@1>!');
        expect(channel3.called).to.be.false;
      });
      describe('Test with lastBirthdayCheck', function() {
        it('Should print birthdays for the 7 april', async function() {
          //Set last birthday check date to 6 April
          await db.botGlobal.updateLastBirthdayCheck('2017-04-06 12:00:00');
          //Set date to 7 April
          clock = sinon.useFakeTimers(1491566400000);
          await notification.birthdays.job();
          expect(channel1.lastCall.lastArg).to.equal('Happy birthday, <@4>!');
          expect(channel2.called).to.be.false;
          expect(channel3.lastCall.lastArg).to.equal('Happy birthday, <@3>!');
        });
        it('Should print missed birthdays', async function() {
          //Set last birthday check date to 3 April
          await db.botGlobal.updateLastBirthdayCheck('2017-04-03 12:00:00');
          //Set date to 7 April
          clock = sinon.useFakeTimers(1491566400000);
          await notification.birthdays.job();
          //Channel 1
          expect(channel1.getCall(channel1.callCount - 3).lastArg).to.equal(
            'Looks like I missed a birthday on 2017-04-05. Belated happy birthday, <@2>!');
          expect(channel1.getCall(channel1.callCount - 2).lastArg).to.equal(
            'Belated happy birthday to me! I\'m now 0 years old!');
          expect(channel1.lastCall.lastArg).to.equal('Happy birthday, <@4>!');
          //Channel 2
          console.log(channel2);
          expect(channel2.getCall(channel2.callCount - 2).lastArg).to.equal(
            'Some birthdays were missed on 2017-04-05 Belated happy birthday to: <@1>, <@2>!');
          expect(channel2.lastCall.lastArg).to.equal(
            'Belated happy birthday to me! I\'m now 0 years old!');
          //Channel 3
          expect(channel3.getCall(channel3.callCount - 2).lastArg).to.equal(
            'Belated happy birthday to me! I\'m now 0 years old!');
          expect(channel3.lastCall.lastArg).to.equal('Happy birthday, <@3>!');
        });
      });
    });
  });
  describe('Test ping', function() {
    let pingCmd = new Ping();
    let clock;
    before(function() {
      clock = sinon.useFakeTimers(1553308630);
    });
    after(function() {
      clock.restore();
    })
    it('Should return "Pong!"', function() {
      msg.createdAt = 1553308565;
      pingCmd.execute(msg, []);
      expect(reply.lastCall.returnValue).to.equal(mustache.render(lang.ping.pong, {
        ping: '65',
        heartbeatPing: '50'
      }))
    });
    it('Should return "Pong!" with an argument', function() {
      msg.createdAt = 1553308560;
      pingCmd.execute(msg, ['argument']);
      expect(reply.lastCall.returnValue).to.equal(mustache.render(lang.ping.pong, {
        ping: '70',
        heartbeatPing: '50'
      }))
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
