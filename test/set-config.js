const sinon = require('sinon');
var args = require('../src/util.js');

exports.setTestConfig = function() {
  var newConfig = args.getConfig();

  //Add some test values
  newConfig[1].locale = 'en-US';
  newConfig[1].pathDatabase = './test/database/test-database.db';
  newConfig[1].levels.cooldown = 3000;

  var stubConfig = sinon.stub(args, 'getConfig');
  stubConfig.returns([newConfig[0], newConfig[1]]);
}
