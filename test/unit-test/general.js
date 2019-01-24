const expect = require('chai').expect;
const mustache = require('mustache');
const lang = require('../../localization/en-US.json');
const testUtil = require('../test-resources/test-util.js');
const { printMsg, msgSend } = testUtil;

var config = require('../../src/util.js').getConfig()[1];
var testMessages = require('../test-resources/test-messages.js');
var msg = testMessages.msg1;

const Help = require('../../src/modules/general/help.js');

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
}
