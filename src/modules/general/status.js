const bot = require('../../bot.js');
const configPath = require('../../args.js').getConfig()[0].slice(1);
const config = require('../../args.js').getConfig()[1];
const fs = require('fs');
var client = bot.client();

module.exports = class statusCommand extends bot.Command {
  constructor() {
    super({
      name: 'status',
      aliases: [],
      category: 'general',
      permLvl: 0
    });
  }
  execute(msg, args) {
    args = args.join(' ');
    client.user.setActivity(args);
    modifyText(configPath, 'currentStatus: \'' + config.currentStatus, 'currentStatus: \'' + args);
    config.currentStatus = args;
  }
}

function modifyText(file, text, value) {
  fs.readFile(file, 'utf8', function(err, data) {
    if (err) {
      return console.log(err);
    }
    var result = data.replace(text, value);

    fs.writeFile(file, result, 'utf8', function(err) {
      if (err) return console.log(err);
    });
  });
}
