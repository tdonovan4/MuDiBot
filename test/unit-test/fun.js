const expect = require('chai').expect;
const sinon = require('sinon');
const lang = require('../../localization/en-US.json');
const db = require('../../src/modules/database/database.js');
const testUtil = require('../test-resources/test-util.js');
const { printMsg, msgSend } = testUtil;

var config = require('../../src/util.js').getConfig()[1];
var testMessages = require('../test-resources/test-messages.js');
var msg = testMessages.msg1;

const customCmds = require('../../src/modules/fun/custom-cmd.js');

module.exports = function() {
  //Test the custom command submodule
  describe('Test custom commands', function() {
    afterEach(function() {
      msgSend.resetHistory;
      printMsg.resetHistory;
    });
    var custCmd = new customCmds.CustCmdCommand();
    describe('Test the custcmd command', function() {
      beforeEach(async function() {
        //Load test database
        await testUtil.replaceDatabase(config.pathDatabase, 'data1.db');
      });
      describe('Test arguments', function() {
        it('custcmd should return missing action', async function() {
          await custCmd.checkArgs(msg, ['test1']);
          expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.missingArg.action);
        });
        it('custcmd should return invalid action', async function() {
          await custCmd.checkArgs(msg, ['test1', 'test']);
          expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.action);
        });
        it('custcmd should return missing message', async function() {
          await custCmd.checkArgs(msg, ['test1', 'say']);
          expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.missingArg.message);
        });
      });
      describe('Test execute()', function() {
        it('custcmd should return too long when using a too long name', async function() {
          await custCmd.execute(msg, ['thisNameIsReallyTooLongToBeACustomCmd',
            'say', 'This', 'is', 'a', 'test'
          ]);
          expect(printMsg.lastCall.returnValue).to.equal(lang.custcmd.tooLong);
        });
        it('custcmd should add the command to the database', async function() {
          await custCmd.execute(msg, ['test3', 'say',
            'This', 'is', 'a', 'test'
          ]);
          var response = await db.customCmd.getCmd(msg.guild.id, 'test3');
          expect(response.name).to.equal('test3');
          expect(printMsg.lastCall.returnValue).to.equal(lang.custcmd.cmdAdded);
        });
        it('custcmd should return that the command already exists', async function() {
          await custCmd.execute(msg, ['test1', 'say', 'This',
            'is', 'a', 'test'
          ]);
          expect(printMsg.lastCall.returnValue).to.equal(lang.error.cmdAlreadyExists);
        });
        it('custcmd should return that the user has too many commands', async function() {
          config.custcmd.maxCmdsPerUser = 1;
          await custCmd.execute(msg, ['test2', 'say', 'This',
            'is', 'a', 'test'
          ]);
          expect(printMsg.lastCall.returnValue).to.equal(lang.error.tooMuch.cmdsUser);
        });
        it('custcmd should add the command to the database when using an administrator', async function() {
          msg.member.permissions.set('ADMINISTRATOR');
          await custCmd.execute(msg, ['test4', 'say', 'This',
            'is', 'a', 'test'
          ]);
          var response = await db.customCmd.getCmd(msg.guild.id, 'test4');
          expect(response.name).to.equal('test4');
          expect(printMsg.lastCall.returnValue).to.equal(lang.custcmd.cmdAdded);
        });
      });
      describe('Test interactive mode', function() {
        it('Should use interactive mode to add a custom command', async function() {
          msg.channel.messages = [
            { ...msg, ...{ content: 'interactive' } },
            { ...msg, ...{ content: 'say' } },
            { ...msg, ...{ content: 'mode' } }
          ];
          await custCmd.interactiveMode(msg);
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
    });

    describe('Test removeCmd', function() {
      beforeEach(async function() {
        //Load test database
        await testUtil.replaceDatabase(config.pathDatabase, 'data1.db');
      });
      var custCmdRemove = new customCmds.CustCmdRemoveCommand();
      describe('Test execute()', function() {
        it('Should return command not found', async function() {
          await custCmdRemove.execute(msg, ['test3']);
          expect(printMsg.lastCall.returnValue).to.equal(lang.error.notFound.cmd);
        });
        it('Should remove test2', async function() {
          await custCmdRemove.execute(msg, ['test2']);
          var response = await db.customCmd.getCmd(msg.guild.id, 'test2');
          expect(response).to.equal(undefined);
          expect(printMsg.lastCall.returnValue).to.equal(lang.custcmdremove.cmdRemoved);
        });
      });
      describe('Test interactive mode', function() {
        it('Should use interactive mode to remove a custom command', async function() {
          msg.channel.messages = [
            { ...msg, ...{ content: 'interactive' } }
          ];
          await custCmdRemove.interactiveMode(msg);
          expect(msgSend.lastCall.returnValue.content).to.equal(
            lang.custcmdremove.interactiveMode.command);
          var response = await db.customCmd.getCmd(msg.guild.id, 'interactive');
          expect(response).to.equal(undefined);
        });
      });
    });

    describe('Test custcmdlist', function() {
      before(async function() {
        //Load test database
        await testUtil.replaceDatabase(config.pathDatabase, 'data1.db');
      });
      after(function() {
        msg.mentions.users.clear();
      });
      var custCmdList = new customCmds.CustCmdListCommand();
      it('Should return info about test1', async function() {
        await custCmdList.execute(msg, ['test1']);
        var embed = msgSend.lastCall.returnValue.content.embed;
        expect(embed.title).to.equal('test1');
        expect(embed.fields[0].value).to.equal('say');
        expect(embed.fields[1].value).to.equal('TestUser');
        expect(embed.fields[2].value).to.equal('test1');
      });
      it('Should return all custom commands', async function() {
        msg.author.id = '357156661105365963';
        //Add another custom cmd
        await db.customCmd.insertCmd(msg.guild.id, msg.author.id, 'test2', 'say', '2');
        await custCmdList.execute(msg, []);
        var response = msgSend.getCall(msgSend.callCount - 2).returnValue.content;
        expect(response).to.have.string('test1');
        expect(response).to.have.string('test2');
      })
      it('Should return all TestUser\'s custom commands', async function() {
        //Add another custom cmd
        msg.mentions.users.set('041025599435591424', {});
        msg.author.id = '041025599435591424';
        await db.customCmd.insertCmd(msg.guild.id, '041226789435591424', 'test3', 'say', '3');
        await custCmdList.execute(msg, ['<@041025599435591424>']);
        var response = msgSend.getCall(msgSend.callCount - 2).returnValue.content;
        expect(response).to.have.string('test1');
        expect(response).to.have.string('test2');
        expect(response).to.not.have.string('test3');
      });
      it('Should return that the list is empty', async function() {
        //Load empty database
        await testUtil.replaceDatabase(config.pathDatabase, 'empty.db');
        await custCmdList.execute(msg, []);
        expect(printMsg.lastCall.returnValue).to.equal(lang.custcmdlist.empty);
      });
    });
    describe('Test executeCmd()', function() {
      var player = sinon.stub(require('../../src/modules/music/audio-player.js'), 'playYoutube');
      after(function() {
        player.restore();
      });
      it('Should print argument with send', function() {
        customCmds.executeCmd(msg, {
          action: 'say',
          arg: 'This is a test'
        });
        expect(msgSend.lastCall.returnValue.content).to.equal('This is a test');
      });
      it('Should play argument with play', function() {
        customCmds.executeCmd(msg, {
          action: 'play',
          arg: 'Drive my car'
        });
        expect(player.lastCall.lastArg).to.equal('Drive my car');
      });
      it('Should return invalid command for every other action', function() {
        customCmds.executeCmd(msg, {
          action: 'test',
        });
        expect(printMsg.lastCall.returnValue).to.equal(lang.error.invalidArg.cmd);
      });
    });
  });
}