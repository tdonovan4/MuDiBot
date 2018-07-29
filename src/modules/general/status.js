const fs = require('fs');
const configPath = require('../../util.js').getConfig()[0].slice(1);
const config = require('../../util.js').getConfig()[1];
const { Command } = require('../../commands.js');
const { client } = require('discord.js');

module.exports = class StatusCommand extends Command {
  constructor() {
    super({
      name: 'status',
      aliases: [],
      category: 'general',
      priority: 1,
      permLvl: 3
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
