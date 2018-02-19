const sinon = require('sinon');
var args = require('../src/args.js');

exports.setTestConfig = function() {
  newConfig = args.getConfig();

  //Add some test values
  newConfig.locale = 'en-US';

  stubConfig = sinon.stub(args, 'getConfig');
  stubConfig.returns(newConfig);
}
