var config = require('./util.js').getConfig()[1];

module.exports = {
  getLocalization: function() {
    var language = require(`../localization/${config.locale}.json`);
    var localization;
    if (language != undefined) {
      localization = language;
    } else {
      //Use english by default in case the chosen language is not found
      localization = require('../languages/en-US.json');
    }
    return localization;
  },
}
