const expect = require('chai').expect;
const lang = require('../../localization/en-US.json');
const db = require('../../src/modules/database/database.js');
const { replaceDatabase } = require('../test-resources/test-util.js');
const testUtil = require('../test-resources/test-util.js');
const { msgSend, printMsg } = testUtil;
var config = require('../../src/util.js').getConfig()[1];
var testMessages = require('../test-resources/test-messages.js');
var msg = testMessages.msg1;

const warnings = require('../../src/modules/warnings/warnings.js');

module.exports = function() {
  describe('Test warn', function() {
    before(function() {
      msg.guild.members.set('1', {
        id: 1,
        user: {
          id: 1
        }
      });
    });
    after(function() {
      msg.guild.members.clear();
    });
    beforeEach(async function() {
      await replaceDatabase(config.pathDatabase, 'data1.db');
    });
    const warnCmd = new warnings.WarnCommand();
    //Test args
    describe('Test arguments', function() {
      it('Should return invalid user', function() {
        warnCmd.checkArgs(msg, ['test']);
        expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.user);
      });
    });
    //Real tests
    describe('Test execute()', function() {
      it('Should increase user\'s warnings by one', async function() {
        msg.guild.id = 2;
        await warnCmd.execute(msg, ['<@!1>']);
        var response = await db.user.getWarnings(msg.guild.id, '1');
        expect(response).to.equal(1);
      });
    });
    //Test interactive mode
    describe('Test interactive mode', function() {
      it('Should use interactive mode to warn user', async function() {
        msg.channel.messages = [
          { ...msg, ...{ content: '<@!1>' } },
        ];
        await warnCmd.interactiveMode(msg);
        expect(msgSend.lastCall.returnValue.content).to.equal(
          lang.warn.interactiveMode.user);
        var response = await db.user.getWarnings(msg.guild.id, '1');
        expect(response).to.equal(1);
      });
    });
  });
  describe('Test unwarn', function() {
    before(function() {
      msg.guild.members.set('1', {
        id: 1,
        user: {
          id: 1
        }
      });
      msg.guild.members.set('2', {
        id: 2,
        user: {
          id: 2
        }
      });
    });
    after(function() {
      msg.guild.members.clear();
    });
    beforeEach(async function() {
      await replaceDatabase(config.pathDatabase, 'data1.db');
    });
    const unwarnCmd = new warnings.UnwarnCommand();
    //Test args
    describe('Test arguments', function() {
      it('Should return invalid user', function() {
        unwarnCmd.checkArgs(msg, ['test']);
        expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.user);
      });
    });
    //Real tests
    describe('Test execute()', function() {
      it('Should decrease user\'s warnings by one', async function() {
        msg.guild.id = 1;
        await unwarnCmd.execute(msg, ['<@!2>']);
        var response = await db.user.getWarnings(msg.guild.id, '2');
        expect(response).to.equal(0);
      });
      it('Should let user\'s warnings at 0 when already 0', async function() {
        msg.guild.id = 2;
        await unwarnCmd.execute(msg, ['<@!1>']);
        var response = await db.user.getWarnings(msg.guild.id, '1');
        expect(response).to.equal(0);
      });
    });
    //Test interactive mode
    describe('Test interactive mode', function() {
      it('Should use interactive mode to unwarn user', async function() {
        msg.guild.id = 1;
        msg.channel.messages = [
          { ...msg, ...{ content: '<@!2>' } },
        ];
        await unwarnCmd.interactiveMode(msg);
        expect(msgSend.lastCall.returnValue.content).to.equal(
          lang.warn.interactiveMode.user);
        var response = await db.user.getWarnings(msg.guild.id, '2');
        expect(response).to.equal(0);
      });
    });
  });
  describe('Test warnlist', function() {
    const warnListCmd = new warnings.WarnListCommand();
    //Test args
    describe('Test arguments', function() {
      it('Should return invalid user', function() {
        warnListCmd.checkArgs(msg, ['test']);
        expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.user);
      });
    });
    //Real tests
    describe('Test execute()', function() {
      describe('Test with empty database', function() {
        beforeEach(async function() {
          await replaceDatabase(config.pathDatabase, 'empty.db');
        });
        it('Should return no warnings', async function() {
          await warnListCmd.execute(msg, []);
          expect(printMsg.lastCall.returnValue).to.equal(lang.warn.noWarns);
        });
      });
      describe('Test with populated database', function() {
        beforeEach(async function() {
          await replaceDatabase(config.pathDatabase, 'data1.db');
        });
        after(function() {
          msg.mentions.users.clear();
        });
        it('Should return all warnings', async function() {
          msg.guild.id = 1;
          await warnListCmd.execute(msg, []);
          expect(printMsg.lastCall.returnValue).to.equal(
            '<@2>: 1 warnings\n<@3>: 2 warnings\n<@4>: 4 warnings');
        });
        it('Should return user 3\'s warnings', async function() {
          //Set user
          msg.mentions.users.set('3', {
            id: '3'
          });
          await warnListCmd.execute(msg, ['<@!3>']);
          expect(printMsg.lastCall.returnValue).to.equal('<@3>: 2 warnings');
        });
      });
    });
  });
  describe('Test purge', function() {
    before(function() {
      msg.guild.members.set('2', {
        id: 2,
        user: {
          id: 2
        }
      });
      msg.guild.members.set('4', {
        id: 4,
        user: {
          id: 4
        }
      });
    });
    after(function() {
      msg.guild.members.clear();
    });
    beforeEach(async function() {
      await replaceDatabase(config.pathDatabase, 'data1.db');
    });
    const warnPurgeCmd = new warnings.WarnPurgeCommand();
    //Test args
    describe('Test arguments', function() {
      it('Should return invalid user', function() {
        warnPurgeCmd.checkArgs(msg, ['test']);
        expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.user);
      });
    });
    //Real tests
    describe('Test execute()', function() {
      it('Should purge user 4', async function() {
        msg.guild.id = 1;
        await warnPurgeCmd.execute(msg, ['<@!4>']);
        var response = await db.user.getWarnings(msg.guild.id, '4');
        expect(response).to.equal(0);
      });
      it('Should purge all', async function() {
        await warnPurgeCmd.execute(msg, ['all']);
        var response = await db.user.getUsersWarnings(msg.guild.id);
        expect(response[0].warning).to.equal(0);
        expect(response[1].warning).to.equal(0);
        expect(response[2].warning).to.equal(0);
      });
    });
    //Test interactive mode
    describe('Test interactive mode', function() {
      it('Should use interactive mode to purge user 2', async function() {
        msg.channel.messages = [
          { ...msg, ...{ content: '$skip' } },
          { ...msg, ...{ content: '<@!2>' } }
        ];
        await warnPurgeCmd.interactiveMode(msg);
        expect(msgSend.getCall(msgSend.callCount - 3).returnValue.content).to.equal(
          lang.warn.interactiveMode.all + ` ${lang.general.interactiveMode.optional}`);
        expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
          lang.general.interactiveMode.skipped);
        expect(msgSend.lastCall.returnValue.content).to.equal(
          lang.warn.interactiveMode.user);
        var response = await db.user.getWarnings(msg.guild.id, '2');
        expect(response).to.equal(0);
      });
      it('Should use interactive mode to purge all', async function() {
        msg.channel.messages = [
          { ...msg, ...{ content: 'all' } },
        ];
        await warnPurgeCmd.interactiveMode(msg);
        expect(msgSend.lastCall.returnValue.content).to.equal(
          lang.warn.interactiveMode.all + ` ${lang.general.interactiveMode.optional}`);
        var response = await db.user.getUsersWarnings(msg.guild.id);
        expect(response[0].warning).to.equal(0);
        expect(response[1].warning).to.equal(0);
        expect(response[2].warning).to.equal(0);
      });
    });
  });
}
