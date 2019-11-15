const expect = require('chai').expect;
const sinon = require('sinon');
const childProcess = require('child_process');
const lang = require('../../localization/en-US.json');
const db = require('../../src/modules/database/database.js');
const testUtil = require('../test-resources/test-util.js');
const client = require('../test-resources/test-client.js');
const { printMsg, msgSend } = testUtil;

var config = require('../../src/util.js').getConfig()[1];
var testMessages = require('../test-resources/test-messages.js');
var msg = testMessages.msg1;

const botManager = require('../../src/modules/administration/bot-manager.js');
const Clearlog = require('../../src/modules/administration/clearlog.js');
const rewards = require('../../src/modules/administration/rewards.js');
const SetChannel = require('../../src/modules/administration/setchannel.js');

module.exports = function() {
  //Test the bot manager submodule
  describe('Test bot manager', function() {
    var stubExit;
    var stubSpawn;
    before(function() {
      //Create the stubs
      stubExit = sinon.stub(process, 'exit');
      stubSpawn = sinon.stub(childProcess, 'spawn');
      stubSpawn.returns({
        unref: function() {
          return;
        }
      });
    });
    beforeEach(function() {
      //Isolate history between each tests
      stubExit.resetHistory();
      stubSpawn.resetHistory();
    });
    after(function() {
      //Restore stubbed functions
      stubExit.restore();
      stubSpawn.restore();
    });
    describe('Test the kill command', function() {
      it('Should call process.exit()', function() {
        new botManager.KillCommand().execute(msg, []);
        expect(stubExit.called).to.be.true;
      });
    });
    describe('Test the restart command', function() {
      it('Should call spawn new process and call process.exit()', function() {
        new botManager.RestartCommand().execute(msg, []);
        expect(stubSpawn.called).to.be.true;
        expect(stubExit.called).to.be.true;
      });
    });
  });

  //Test the clearlog submodule
  describe('Test clearlog', function() {
    afterEach(function() {
      //Reset
      msg.content = '';
      msg.mentions.users.clear();
      msg.deletedMessages = [];
    });
    const clearlogCmd = new Clearlog();
    it('Should delete nothing', async function() {
      msg.content = '$clearlog 0';
      await clearlogCmd.execute(msg, ['0']);
      var deletedMessages = msg.deletedMessages;
      expect(deletedMessages).to.deep.equal([]);
    });
    it('Should delete commands and messages by client', async function() {
      msg.content = '$clearlog';
      await clearlogCmd.execute(msg, []);
      var deletedMessages = msg.deletedMessages;
      expect(deletedMessages).to.deep.equal(['$ping', 'this', '$info', '$help help', 'a', '$profile']);
    })
    it('Should delete message containing "This is a test"', async function() {
      await clearlogCmd.execute(msg, ['This', 'is', 'a', 'test', '10']);
      var deletedMessages = msg.deletedMessages;
      expect(deletedMessages).to.deep.equal(['This is a test 123']);
    })
    it('Should delete messages by user with id 384633488400140664', async function() {
      msg.mentions.users.set('384633488400140664', {
        id: '384633488400140664'
      });
      await clearlogCmd.execute(msg, ['<@384633488400140664>', '15']);
      var deletedMessages = msg.deletedMessages;
      expect(deletedMessages).to.deep.equal(['flower', 'pot']);
    });
    it('Should delete messages by user with id 384633488400140664 if changed nickname', async function() {
      msg.mentions.users.set('384633488400140664', {
        id: '384633488400140664'
      });
      await clearlogCmd.execute(msg, ['<@384633488400140664>', '15']);
      var deletedMessages = msg.deletedMessages;
      expect(deletedMessages).to.deep.equal(['flower', 'pot']);
    });
    it('Should delete message with flower by user with id 384633488400140664', async function() {
      msg.mentions.users.set('384633488400140664', {
        id: '384633488400140664'
      });
      await clearlogCmd.execute(msg, ['<@384633488400140664>', 'flower', '15']);
      var deletedMessages = msg.deletedMessages;
      expect(deletedMessages).to.deep.equal(['flower']);
    });
    it('Should delete message with filters inversed', async function() {
      msg.mentions.users.set('384633488400140664', {
        id: '384633488400140664'
      });
      await clearlogCmd.execute(msg, ['flower', '<@384633488400140664>', '15']);
      var deletedMessages = msg.deletedMessages;
      expect(deletedMessages).to.deep.equal(['flower']);
    });
    it('Should delete all messages', async function() {
      await clearlogCmd.execute(msg, ['all', '15']);
      var deletedMessages = msg.deletedMessages;
      expect(deletedMessages.length).to.equal(13);
    });
  });

  describe('Test rewards', function() {
    beforeEach(async function() {
      //Load test database
      await testUtil.replaceDatabase(config.pathDatabase, 'data1.db');
    });
    afterEach(function() {
      msgSend.resetHistory;
      printMsg.resetHistory;
    });
    describe('Test the setreward command', function() {
      const setReward = new rewards.SetRewardCommand();
      describe('Test arguments', function() {
        it('Should return missing argument: reward', async function() {
          await setReward.checkArgs(msg, ['farmer']);
          expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.missingArg.reward);
        });
        it('Should return rank not found', async function() {
          await setReward.checkArgs(msg, ['test', 'member']);
          expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.notFound.rank);
        });
        it('Should return invalid reward', async function() {
          await setReward.checkArgs(msg, ['King', 'string']);
          expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.reward);
        });
      });
      describe('Test execute()', function() {
        it('Should set the reward for king (permission group)', async function() {
          await setReward.execute(msg, ['King', 'member']);
          var response = await db.reward.getRankReward(msg.guild.id, 'King');
          expect(response).to.equal('Member');
        });
        it('Should set the reward for emperor (role)', async function() {
          //Add roles
          msg.guild.roles.set('1', {
            id: '1'
          });
          await setReward.execute(msg, ['emperor', '<@&1>']);
          var response = await db.reward.getRankReward(msg.guild.id, 'Emperor');
          expect(response).to.equal('1');
        });
        it('Should update the reward for farmer', async function() {
          msg.guild.roles.set('2', {
            id: '2'
          });
          await setReward.execute(msg, ['farmer', '<@&2>']);
          var response = await db.reward.getRankReward(msg.guild.id, 'Farmer');
          expect(response).to.equal('2');
        });
      });
      describe('Test interactive mode', function() {
        it('Should use interactive mode to modify the reward for farmer (rank)', async function() {
          msg.channel.messages = [
            { ...msg, ...{ content: 'farmer' } },
            { ...msg, ...{ content: 'Member' } }
          ];
          await setReward.interactiveMode(msg);
          expect(msgSend.getCall(msgSend.callCount - 3).returnValue.content).to.equal(
            lang.setreward.interactiveMode.rank);
          expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
            lang.setreward.interactiveMode.reward);
          expect(msgSend.lastCall.returnValue.content).to.equal(
            lang.setreward.newReward);
          var response = await db.reward.getRankReward(msg.guild.id, 'Farmer');
          expect(response).to.equal('Member');
        });
        it('Should use interactive mode to modify the reward for farmer (role)', async function() {
          msg.channel.messages = [
            { ...msg, ...{ content: 'farmer' } },
            { ...msg, ...{ content: '<@&2>' } }
          ];
          await setReward.interactiveMode(msg);
          expect(msgSend.getCall(msgSend.callCount - 3).returnValue.content).to.equal(
            lang.setreward.interactiveMode.rank);
          expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
            lang.setreward.interactiveMode.reward);
          expect(msgSend.lastCall.returnValue.content).to.equal(
            lang.setreward.newReward);
          var response = await db.reward.getRankReward(msg.guild.id, 'Farmer');
          expect(response).to.equal('2');
        });
      });
    });
    describe('Test the unsetreward command', function() {
      const unsetReward = new rewards.UnsetRewardCommand();
      describe('Test arguments', function() {
        it('Should return rank not found', async function() {
          await unsetReward.checkArgs(msg, ['random']);
          expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.notFound.rank);
        });
      });
      describe('Test execute()', function() {
        it('Should return rank reward not found', async function() {
          await unsetReward.execute(msg, ['emperor']);
          expect(printMsg.lastCall.returnValue).to.equal(lang.error.notFound.rankReward);
        });
        it('Should remove the reward for farmer', async function() {
          await unsetReward.execute(msg, ['farmer']);
          var response = await db.reward.getRankReward(msg.guild.id, 'Farmer');
          expect(response).to.equal(undefined);
        });
      });
      describe('Test interactive mode', function() {
        it('Should use interactive mode to remove the reward for farmer', async function() {
          msg.channel.messages = [
            { ...msg, ...{ content: 'farmer' } }
          ];
          await unsetReward.interactiveMode(msg);
          expect(msgSend.lastCall.returnValue.content).to.equal(
            lang.setreward.interactiveMode.rank);
          var response = await db.reward.getRankReward(msg.guild.id, 'Farmer');
          expect(response).to.equal(undefined);
        });
      });
    });
  });

  //Test the setchannel submodule
  describe('Test setchannel', function() {
    const setchannelCmd = new SetChannel();
    beforeEach(async function() {
      //Load test database
      await testUtil.replaceDatabase(config.pathDatabase, 'data1.db');
    });
    it('Should set the current channel as the default channel', async function() {
      //Setup
      msg.channel.id = '123456';
      client.channels.set(msg.channel.id, {
        id: msg.channel.id
      });
      //Real test
      await setchannelCmd.execute(msg);
      var response = await db.config.getDefaultChannel(msg.guild.id);
      expect(response.id).to.equal('123456');
    });
  });
}
