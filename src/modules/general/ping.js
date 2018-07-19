const { Command } = require('../../commands.js');
var lang = require('../../localization.js').getLocalization();

module.exports = class PingCommand extends Command {
  constructor() {
    super({
      name: 'ping',
      aliases: [],
      category: 'general',
      priority: 9,
      permLvl: 0
    });
  }
  execute(msg) {
    msg.reply(lang.ping.pong);
    console.log(lang.ping.pong);
  }
}
