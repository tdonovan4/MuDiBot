const expect = require('chai').expect;
const sinon = require('sinon');
const testUtil = require('../test-resources/test-util.js');
const { msgSend } = testUtil;
const lang = require('../../localization/en-US.json');
var testMessages = require('../test-resources/test-messages.js');
var msg = testMessages.msg1;

const commands = require('../../src/commands.js');

module.exports = function() {
  describe('Test Command', function() {
    describe('Test checkArgs', function() {
      var interactiveStub;
      before(function() {
        //Disable interactive mode during the tests
        interactiveStub = sinon.stub(commands.Command.prototype, 'interactiveMode');
      });
      after(function() {
        //Remove the stub at the end
        interactiveStub.restore();
      });
      afterEach(function() {
        //Make sure each test is isolated
        interactiveStub.resetHistory();
      })
      describe('Test a command without args', function() {
        it('Should return true when not giving an arg', function() {
          var response = commands.getCmd('ping').checkArgs(msg, []);
          expect(response).to.equal(true);
        });
        it('Should return true when giving an arg', function() {
          var response = commands.getCmd('ping').checkArgs(msg, ['test']);
          expect(response).to.equal(true);
        });
      });
      describe('Test command with an optional arg', function() {
        it('Should return true not giving an arg', function() {
          var response = commands.getCmd('status').checkArgs(msg, []);
          expect(response).to.equal(true);
        });
        it('Should return true when giving an arg', function() {
          var response = commands.getCmd('status').checkArgs(msg, ['test']);
          expect(response).to.equal(true);
        });
      });
      describe('Test command with a mandatory arg', function() {
        it('Should return true not giving an arg', function() {
          var response = commands.getCmd('say').checkArgs(msg, []);
          expect(response).to.equal(false);
        });
        it('Should return true when giving an arg', function() {
          var response = commands.getCmd('say').checkArgs(msg, ['test']);
          expect(response).to.equal(true);
        });
      });
      describe('Test when interactive mode is enabled', function() {
        it('Should not enable it when not having a mandatory arg and not giving one', function() {
          commands.getCmd('ping').checkArgs(msg, ['']);
          expect(interactiveStub.called).to.equal(false);
        });
        it('Should not enable it when not having a mandatory arg and giving one', function() {
          commands.getCmd('ping').checkArgs(msg, ['test']);
          expect(interactiveStub.called).to.equal(false);
        });
        it('Should not enable it when only habing an optional arg and not giving one', function() {
          commands.getCmd('profile').checkArgs(msg, []);
          expect(interactiveStub.called).to.equal(false);
        });
        it('Should not enable it when only having an optional arg and giving one', function() {
          commands.getCmd('profile').checkArgs(msg, ['test']);
          expect(interactiveStub.called).to.equal(false);
        });
        it('Should enable it when having a mandatory arg and not giving one', function() {
          commands.getCmd('warn').checkArgs(msg, []);
          expect(interactiveStub.called).to.equal(true);
        });
        it('Should not enable it when having a mandatory arg and giving one', function() {
          commands.getCmd('warn').checkArgs(msg, ['test']);
          expect(interactiveStub.called).to.equal(false);
        });
      });
      describe('Test argument validation', function() {
        describe('Test command with a mention', function() {
          it('Should return false with wrong mention', function() {
            var response = commands.getCmd('avatar').checkArgs(msg, ['test']);
            expect(response).to.equal(false);
          });
          it('Should return true with good mention', function() {
            var response = commands.getCmd('avatar').checkArgs(msg, ['<@1>']);
            expect(response).to.equal(true);
          });
          it('Should return true with nickname mention', function() {
            var response = commands.getCmd('avatar').checkArgs(msg, ['<@!1>']);
            expect(response).to.equal(true);
          });
        })
        describe('Test command with an array of possible values', function() {
          it('Should return true without args (optional)', function() {
            var response = commands.getCmd('help').checkArgs(msg, []);
            expect(response).to.equal(true);
          });
          it('Should return true without a right command', function() {
            var response = commands.getCmd('help').checkArgs(msg, ['ping']);
            expect(response).to.equal(true);
          });
          it('Should return false with a wrong command', function() {
            var response = commands.getCmd('help').checkArgs(msg, ['test']);
            expect(response).to.equal(false);
          });
        });
        describe('Test command with two args, one requiring a channel type', function() {
          before(function() {
            msg.guild.channels.set('1', {});
          });
          it('Should return true with only the message', function() {
            var response = commands.getCmd('say').checkArgs(msg, ['message']);
            expect(response).to.equal(true);
          });
          it('Should return true with wrong channel', function() {
            //The wrong channel is taken as a message
            var response = commands.getCmd('say').checkArgs(msg, ['<#10902382902>', 'message']);
            expect(response).to.equal(true);
          });
          it('Should return true with right channel', function() {
            var response = commands.getCmd('say').checkArgs(msg, ['<#1>', 'message']);
            expect(response).to.equal(true);
          });
        });
        describe('Test command with two args, one requiring a group type', function() {
          it('Should return false with only a mention', function() {
            var response = commands.getCmd('setgroup').checkArgs(msg, ['<@1>']);
            expect(response).to.equal(false);
          });
          it('Should return false with wrong group', function() {
            var response = commands.getCmd('setgroup').checkArgs(msg, ['<@1>', 'test']);
            expect(response).to.equal(false);
          });
          it('Should return true with right group', function() {
            var response = commands.getCmd('setgroup').checkArgs(msg, ['<@1>', 'user']);
            expect(response).to.equal(true);
          });
        });
        describe('Test command with rank and rewards', function() {
          it('Should return false with wrong rank', function() {
            var response = commands.getCmd('setreward').checkArgs(msg, ['test', 'Member']);
            expect(response).to.equal(false);
          });
          it('Should return true with right rank', function() {
            var response = commands.getCmd('setreward').checkArgs(msg, ['XP_Master', 'Member']);
            expect(response).to.equal(true);
          });
          it('Should return false with wrong reward', function() {
            var response = commands.getCmd('setreward').checkArgs(msg, ['XP_Master', 'test']);
            expect(response).to.equal(false);
          });
          it('Should return true with group reward', function() {
            var response = commands.getCmd('setreward').checkArgs(msg, ['XP_Master', 'Member']);
            expect(response).to.equal(true);
          });
          it('Should return true with role reward', function() {
            msg.guild.roles.set('1', {});
            var response = commands.getCmd('setreward').checkArgs(msg, ['XP_Master', '<@&1>']);
            expect(response).to.equal(true);
          });
        });
        describe('Test commands with breakOnValid', function() {
          it('Should return false with test', function() {
            var response = commands.getCmd('warnpurge').checkArgs(msg, ['test']);
            expect(response).to.equal(false);
          });
          it('Should return true with all', function() {
            var response = commands.getCmd('warnpurge').checkArgs(msg, ['all']);
            expect(response).to.equal(true);
          });
          it('Should return true with player', function() {
            var response = commands.getCmd('warnpurge').checkArgs(msg, ['<@1>']);
            expect(response).to.equal(true);
          });
        });
      });
    });
    describe('Test interactive mode', function() {
      var avatarStub;
      var setgroupStub;
      before(function() {
        //Disable some commands during the tests
        avatarStub = sinon.stub(commands.getCmd('avatar'), 'execute');
        setgroupStub = sinon.stub(commands.getCmd('setgroup'), 'execute');
      });
      after(function() {
        //Remove the stubs at the end
        avatarStub.restore();
        setgroupStub.restore();
      })
      afterEach(function() {
        //Make sure each test is isolated
        avatarStub.resetHistory();
        setgroupStub.resetHistory();
      })
      describe('Test interactive mode for 1 argument', function() {
        it('Should return invalid user', async function() {
          msg.channel.messages = [
            { ...msg, ...{ content: 'test' } }
          ];
          await commands.getCmd('avatar').interactiveMode(msg);
          expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
            lang.avatar.interactiveMode.user);
          expect(msgSend.lastCall.returnValue.content).to.equal(
            lang.error.invalidArg.user);
        });
        it('The command should work', async function() {
          msg.channel.messages = [
            { ...msg, ...{ content: '<@1>' } }
          ];
          await commands.getCmd('avatar').interactiveMode(msg);
          expect(msgSend.lastCall.returnValue.content).to.equal(
            lang.avatar.interactiveMode.user);
          expect(avatarStub.called).to.equal(true);
        });
      });
      describe('Test interactive mode for 2 arguments', function() {
        it('Should return invalid user', async function() {
          msg.channel.messages = [
            { ...msg, ...{ content: 'test' } }
          ];
          await commands.getCmd('setgroup').interactiveMode(msg);
          expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
            lang.setgroup.interactiveMode.user);
          expect(msgSend.lastCall.returnValue.content).to.equal(
            lang.error.invalidArg.user);
        });
        it('Should return group not found', async function() {
          msg.channel.messages = [
            { ...msg, ...{ content: `<@${msg.author.id}>` } },
            { ...msg, ...{ content: 'test' } }
          ];
          await commands.getCmd('setgroup').interactiveMode(msg);
          expect(msgSend.getCall(msgSend.callCount - 3).returnValue.content).to.equal(
            lang.setgroup.interactiveMode.user);
          expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
            lang.setgroup.interactiveMode.group);
          expect(msgSend.lastCall.returnValue.content).to.equal(
            lang.error.notFound.group);
        });
        it('The command should work', async function() {
          msg.channel.messages = [
            { ...msg, ...{ content: `<@${msg.author.id}>` } },
            { ...msg, ...{ content: 'admin' } }
          ];
          await commands.getCmd('setgroup').interactiveMode(msg);
          expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
            lang.setgroup.interactiveMode.user);
          expect(msgSend.lastCall.returnValue.content).to.equal(
            lang.setgroup.interactiveMode.group);
          expect(setgroupStub.called).to.equal(true);
        });
      });
      describe('Test interactive mode with optional argument', function() {
        it('Should skip alternative argument', async function() {
          msg.channel.messages = [
            { ...msg, ...{ content: '$skip' } },
            { ...msg, ...{ content: 'test' } }
          ];
          await commands.getCmd('say').interactiveMode(msg);
          expect(msgSend.getCall(msgSend.callCount - 4).returnValue.content).to.equal(
            lang.say.interactiveMode.channel + ` ${lang.general.interactiveMode.optional}`);
          expect(msgSend.getCall(msgSend.callCount - 3).returnValue.content).to.equal(
            lang.general.interactiveMode.skipped);
          expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
            lang.say.interactiveMode.message);
          expect(msgSend.lastCall.returnValue.content).to.equal(
            'test');
        });
      });
    });
  });
}
