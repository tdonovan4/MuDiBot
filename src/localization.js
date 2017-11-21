var config = require('./args.js').getConfig();

module.exports = {
  getLocalization: function() {
    var language = require(`../localization/${config.locale}.json`);
    if (language != undefined) {
      localization = language;
    } else {
      //Use english by default in case the chosen language is not found
      localization = require('../languages/en-US.json');
    }
    return localization;
  },
}
