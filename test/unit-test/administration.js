const expect = require('chai').expect;
const sinon = require('sinon');
const childProcess = require('child_process');
var testMessages = require('../test-resources/test-messages.js');
var msg = testMessages.msg1;

const botManager = require('../../src/modules/administration/bot-manager.js');
const Clearlog = require('../../src/modules/administration/clearlog.js');

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
      msg.content = '$clearlog 1';
      await clearlogCmd.execute(msg, ['1']);
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
  });
}
