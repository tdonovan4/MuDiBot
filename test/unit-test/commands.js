const expect = require('chai').expect;
const sinon = require('sinon');
const mustache = require('mustache');
const testUtil = require('../test-resources/test-util.js');
const { msgSend } = testUtil;
const lang = require('../../localization/en-US.json');
const config = require('../../src/util.js').getConfig()[1];
const fs = require('fs');
var testMessages = require('../test-resources/test-messages.js');
var msg = testMessages.msg1;

const commands = require('../../src/commands.js');
const permGroups = require('../../src/modules/user/permission-group.js');

//Register stuff
commands.registerCategories(config.categories);
commands.registerCommands();

module.exports = function() {
  describe('Test Argument', function() {
    describe('Test checkArg', function() {
      describe('Test the int type', function() {
        it('Should return true with an integer', function() {
          var testArg = new commands.Argument({
            type: 'int'
          });
          expect(testArg.checkArg(msg, 1)).to.be.true;
        });
        it('Should return false with a string', function() {
          var testArg = new commands.Argument({
            type: 'int'
          });
          expect(testArg.checkArg(msg, 'test')).to.be.false;
        });
        it('Should return true with a string that is a number', function() {
          var testArg = new commands.Argument({
            type: 'int'
          });
          expect(testArg.checkArg(msg, '1')).to.be.true;
        });
      });
      describe('Test the channel type', function() {
        before(function() {
          msg.guild.channels.set('1', {});
        });
        after(function() {
          msg.guild.channels.clear();
        });
        it('Should return true with a valid channel', function() {
          var testArg = new commands.Argument({
            type: 'channel'
          });
          expect(testArg.checkArg(msg, '<#1>')).to.be.true;
        });
        it('Should return false with a random string', function() {
          var testArg = new commands.Argument({
            type: 'channel'
          });
          expect(testArg.checkArg(msg, 'test')).to.be.false;
        });
        it('Should return false with an invalid channel', function() {
          var testArg = new commands.Argument({
            type: 'channel'
          });
          expect(testArg.checkArg(msg, '<#2>')).to.be.false;
        });
      });
      describe('Test the mention type', function() {
        it('Should return true with a valid mention', function() {
          var testArg = new commands.Argument({
            type: 'mention'
          });
          expect(testArg.checkArg(msg, '<@!1>')).to.be.true;
        });
        it('Should return false with a random string', function() {
          var testArg = new commands.Argument({
            type: 'mention'
          });
          expect(testArg.checkArg(msg, 'test')).to.be.false;
        });
        it('Should return false with an invalid mention', function() {
          var testArg = new commands.Argument({
            type: 'mention'
          });
          expect(testArg.checkArg(msg, '<@!2>')).to.be.false;
        });
      });
      describe('Test the group type', function() {
        it('Should return true with a valid group', function() {
          var testArg = new commands.Argument({
            type: 'group'
          });
          expect(testArg.checkArg(msg, 'mod')).to.be.true;
        });
        it('Should return false with an invalid group', function() {
          var testArg = new commands.Argument({
            type: 'group'
          });
          expect(testArg.checkArg(msg, 'test')).to.be.false;
        });
      });
      describe('Test the rank type', function() {
        it('Should return true with a valid rank', function() {
          var testArg = new commands.Argument({
            type: 'rank'
          });
          expect(testArg.checkArg(msg, 'king')).to.be.true;
        });
        it('Should return false with an invalid rank', function() {
          var testArg = new commands.Argument({
            type: 'rank'
          });
          expect(testArg.checkArg(msg, 'test')).to.be.false;
        });
      });
      describe('Test the reward type', function() {
        before(function() {
          msg.guild.roles.set('1', {});
        });
        after(function() {
          msg.guild.roles.clear();
        });
        it('Should return true with a valid group', function() {
          var testArg = new commands.Argument({
            type: 'reward'
          });
          expect(testArg.checkArg(msg, 'mod')).to.be.true;
        });
        it('Should return false with an invalid group', function() {
          var testArg = new commands.Argument({
            type: 'reward'
          });
          expect(testArg.checkArg(msg, 'god')).to.be.false;
        });
        it('Should return true with a valid role', function() {
          var testArg = new commands.Argument({
            type: 'reward'
          });
          expect(testArg.checkArg(msg, '<@&1>')).to.be.true;
        });
        it('Should return false with an invalid role', function() {
          var testArg = new commands.Argument({
            type: 'reward'
          });
          expect(testArg.checkArg(msg, '<@&21>')).to.be.false;
        });
        it('Should return false with a random string', function() {
          var testArg = new commands.Argument({
            type: 'reward'
          });
          expect(testArg.checkArg(msg, 'test')).to.be.false;
        });
      });
      describe('Test the possible values', function() {
        it('Should return true if in the values', function() {
          var testArg = new commands.Argument({
            possibleValues: ['test1', 'test2', 'test3']
          });
          expect(testArg.checkArg(msg, 'test2')).to.be.true;
        });
        it('Should return false if not in the values', function() {
          var testArg = new commands.Argument({
            possibleValues: ['test1', 'test2', 'test3']
          });
          expect(testArg.checkArg(msg, 'test4')).to.be.false;
        });
      });
    });
  });
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
  describe('Test Category', function() {
    describe('Test addCommand', function() {
      it('Should add a command to the category', function() {
        var testCmd = new commands.Command({
          name: 'testCmd',
          priority: 3
        });
        var testCategory = new commands.Category({
          name: 'testCategory',
          priority: 1
        });
        testCategory.addCommand(testCmd);
        expect(testCategory.commands.get('testCmd').priority).to.equal(3);
      });
    });
  });
  describe('Test registerCategories()', function() {
    beforeEach(function() {
      //Reset the map
      commands.categories.clear();
    });
    after(function() {
      //Restore
      commands.registerCategories(config.categories);
    });
    it('Should add the categories to the map', function() {
      var categories = [
        new commands.Category({
          name: 'testCategory',
          priority: 1
        }),
        new commands.Category({
          name: 'testCategory2',
          priority: 2
        }),
      ];
      commands.registerCategories(categories);
      expect(commands.categories.has('testCategory')).to.be.true;
      expect(commands.categories.has('testCategory2')).to.be.true;
    });
    it('Should append new categories to existing ones', function() {
      //Add a category before testing
      var category = new commands.Category({
        name: 'testCategory3',
        priority: 1
      });
      commands.categories.set(category.name, category);
      //Test
      commands.registerCategories([
        new commands.Category({
          name: 'testCategory4',
          priority: 2
        })
      ]);
      expect(commands.categories.has('testCategory3')).to.be.true;
      expect(commands.categories.has('testCategory4')).to.be.true;
    });
    it('Should return "Error, not an array" without categories', function() {
      commands.registerCategories();
      expect(testUtil.spyLog.lastCall.args[0]).to.equal(
        mustache.render(lang.error.notArray, { var: 'categories' }));
    });
  });
  describe('Test registerCommands()', function() {
    //Set stubs
    var readdirSync;
    var statSync;
    var loadFile;
    before(function() {
      readdirSync = sinon.stub(fs, 'readdirSync');
      statSync = sinon.stub(fs, 'statSync');
      loadFile = sinon.stub(commands, 'loadFile');
    });
    //Clean up after
    after(function() {
      readdirSync.restore();
      statSync.restore();
      loadFile.restore();
      commands.registerCommands();
    });
    //Isolate tests
    beforeEach(function() {
      commands.commands.clear();
    });

    //Helper function to return the fake modules
    function stubRead(modules) {
      readdirSync.resetHistory();
      readdirSync.callsFake(function(path) {
        var module = path.split('./src/modules/')[1];
        return modules.get(module);
      });
      readdirSync.onFirstCall().returns(Array.from(modules.keys()));
    }

    it('Should add a command', function() {
      //Setup stubs
      stubRead(new Map([
        ['general', ['submodule1']]
      ]));
      statSync.returns({
        isFile: function() {
          return true;
        }
      });
      loadFile.returns({
        TestCommand: class extends commands.Command {
          constructor() {
            super({
              name: 'test',
              aliases: [],
              category: 'general',
              priority: 9,
              permLvl: 0
            });
          }
        }
      });
      //Actual testing
      commands.registerCommands();
      expect(commands.commands.has('test')).to.be.true;
    });
    it('Should add multiple commands', function() {
      //Setup stubs
      stubRead(new Map([
        ['general', ['submodule1']],
        ['fun', ['submodule2', 'submodule3']]
      ]));
      statSync.returns({
        isFile: function() {
          return true;
        }
      });
      loadFile.onFirstCall().returns({
        TestCommand: class extends commands.Command {
          constructor() {
            super({
              name: 'test',
              aliases: [],
              category: 'general',
              priority: 9,
              permLvl: 0
            });
          }
        }
      });
      loadFile.onSecondCall().returns({
        TestCommand2: class extends commands.Command {
          constructor() {
            super({
              name: 'test2',
              aliases: [],
              category: 'general',
              priority: 9,
              permLvl: 0
            });
          }
        },
        TestCommand3: class extends commands.Command {
          constructor() {
            super({
              name: 'test3',
              aliases: [],
              category: 'general',
              priority: 9,
              permLvl: 0
            });
          }
        }
      });
      loadFile.onThirdCall().returns({
        value: 1
      });
      //Actual testing
      commands.registerCommands();
      expect(commands.commands.size).to.equal(3);
      expect(commands.commands.has('test')).to.be.true;
      expect(commands.commands.has('test2')).to.be.true;
      expect(commands.commands.has('test3')).to.be.true;
    });
    it('Should add a command mixed with non-commands', function() {
      //Setup stubs
      stubRead(new Map([
        ['general', ['submodule1']]
      ]));
      statSync.returns({
        isFile: function() {
          return true;
        }
      });
      loadFile.returns({
        testValue: 'true',
        Test2Command: class extends commands.Command {
          constructor() {
            super({
              name: 'test2',
              aliases: [],
              category: 'general',
              priority: 9,
              permLvl: 0
            });
          }
        },
        testFunction: function() {
          return false
        }
      });
      //Actual testing
      commands.registerCommands();
      expect(commands.commands.size).to.equal(1);
      expect(commands.commands.has('test2')).to.be.true;
    });
    it('Should not break with no submodule', function() {
      //Setup stubs
      stubRead(new Map([
        ['general', []]
      ]));
      statSync.returns({
        isFile: function() {
          return false;
        }
      });
      loadFile.returns({});
      //Actual testing
      commands.registerCommands();
      expect(commands.commands.size).to.equal(0);
    });
    it('Should not break with no module', function() {
      //Setup stubs
      stubRead(new Map());
      statSync.returns({
        isFile: function() {
          return false;
        }
      });
      loadFile.returns({});
      //Actual testing
      commands.registerCommands();
      expect(commands.commands.size).to.equal(0);
    });
    it('Should not break with a folder', function() {
      //Setup stubs
      stubRead(new Map([
        ['general', ['myFolder']]
      ]));
      statSync.returns({
        isFile: function() {
          return false;
        }
      });
      loadFile.returns({});
      //Actual testing
      commands.registerCommands();
      expect(commands.commands.size).to.equal(0);
    });
    it('Should not break if the file doesn\'t have exports', function() {
      //Setup stubs
      stubRead(new Map([
        ['general', ['submodule1']]
      ]));
      statSync.returns({
        isFile: function() {
          return false;
        }
      });
      loadFile.returns({});
      //Actual testing
      commands.registerCommands();
      expect(commands.commands.size).to.equal(0);
    });
  });
  describe('Test checkPerm()', function() {
    afterEach(async function() {
      //Clean up
      config.superusers = [''];
      await testUtil.replaceDatabase(config.pathDatabase, 'empty.db');
    })
    it('Should return true when user has the permLvl', async function() {
      //Setup
      await commands.executeCmd(msg, ['purgegroups', `<@${msg.author.id}>`]);
      msg.member.permissions.clear();
      var response = await commands.checkPerm(msg, 0);
      expect(response).to.equal(true);
    });
    it('Should return false when user don\'t have the permLvl', async function() {
      var response = await commands.checkPerm(msg, 1);
      expect(response).to.equal(false);
    });
    it('Should return true if user now have permLvl', async function() {
      await permGroups.setGroup(msg, msg.author, 'Member');
      var response = await commands.checkPerm(msg, 1);
      expect(response).to.equal(true);
    });
    it('Should return true if user has multiple permGroups', async function() {
      await permGroups.setGroup(msg, msg.author, 'Member');
      await permGroups.setGroup(msg, msg.author, 'User');
      var response = await commands.checkPerm(msg, 1);
      expect(response).to.equal(true);
    });
    it('Should return true if user has ADMINISTRATOR permissions', async function() {
      msg.member.permissions.set('ADMINISTRATOR');
      var response = await commands.checkPerm(msg, 3);
      expect(response).to.equal(true);
    })
    it('Should return true if user is a superuser', async function() {
      msg.member.permissions.clear();
      config.superusers = [msg.author.id];
      var response = await commands.checkPerm(msg, 3);
      expect(response).to.equal(true);
    });
  });
  describe('Test getCmd()', function() {
    it('Should return the command', function() {
      var cmd = commands.getCmd('ping');
      expect(cmd.name).to.equal('ping');
    });
    it('Should return the command when using alias', function() {
      var cmd = commands.getCmd('clear');
      expect(cmd.name).to.equal('clearlog');
    });
    it('Should return undefined if wrong command', function() {
      var cmd = commands.getCmd('deadeaf');
      expect(cmd).to.equal(undefined);
    });
    it('Should return undefined if the command is deactivated', function() {
      config.ping.activated = false;
      var cmd = commands.getCmd('ping');
      expect(cmd).to.equal(undefined);
    });
    after(function() {
      //Reset
      config.ping.activated = true;
    });
  });
  //Future stub
  var checkPerm;
  describe('Test checkIfValidCmd()', function() {
    before(function() {
      checkPerm = sinon.stub(commands, 'checkPerm');
      checkPerm.resolves(true);
    });
    it('Should return false when using a false command', async function() {
      //Change content of message
      msg.content = 'randomString';
      var response = await commands.checkIfValidCmd(msg, ['randomString']);
      expect(response).to.equal(false);
    });
    it('Should return false when using wrong prefix', async function() {
      msg.content = '!help';
      var response = await commands.checkIfValidCmd(msg, ['help']);
      expect(response).to.equal(false);
    });
    it('Should return true when using a real command', async function() {
      msg.content = '$help';
      var response = await commands.checkIfValidCmd(msg, ['help']);
      expect(response).to.equal(true);
    })
    it('Should return true with aliases', async function() {
      msg.content = '$help';
      var response = await commands.checkIfValidCmd(msg, ['cc']);
      expect(response).to.equal(true);
    });
    it('Should return false if command is deactivated', async function() {
      config.help.activated = false
      var response = await commands.checkIfValidCmd(msg, ['help']);
      expect(response).to.equal(false);
    });
    it('Should return false when user doesn\'t have permission to execute', async function() {
      checkPerm.resolves(false);
      var response = await commands.checkIfValidCmd(msg, ['help']);
      expect(response).to.equal(false);
    });
    after(function() {
      //Reset
      config.help.activated = true
      checkPerm.restore();
    });
  });
  describe('Test executeCmd', function() {
    var testCommand;
    before(function() {
      class TestCommand extends commands.Command {
        constructor() {
          super({
            name: 'test',
            aliases: [],
            category: 'general',
            priority: 9,
            permLvl: 0
          });
        }
        execute(msg, args) {
          return [msg, args];
        }
      }
      commands.commands.set('test', new TestCommand());
      testCommand = sinon.spy(commands.commands.get('test'), 'execute');
    });
    after(function() {
      //Reset
      commands.commands.clear();
      commands.registerCommands();
    });
    it('Should execute a command without arguments', function() {
      commands.executeCmd(msg, ['test']);
      expect(testCommand.called).to.be.true;
    });
    it('Should execute a command with arguments', function() {
      commands.executeCmd(msg, ['test', 'arg1', 'arg2']);
      expect(testCommand.lastCall.args[1]).to.deep.equal(['arg1', 'arg2']);
    });
  });
}
