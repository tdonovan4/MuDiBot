const expect = require('chai').expect;
const sinon = require('sinon');
const childProcess = require('child_process');
var testMessages = require('../test-resources/test-messages.js');
var msg = testMessages.msg1;

const botManager = require('../../src/modules/administration/bot-manager.js');

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
}
