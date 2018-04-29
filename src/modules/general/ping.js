const bot = require('../../bot.js');
var lang = require('../../localization.js').getLocalization();

module.exports = class PingCommand extends bot.Command {
  constructor() {
    super({
      name: 'ping',
      aliases: [],
      category: 'general',
      priority: 9,
      permLvl: 0
    });
  }
  execute(msg, args) {
    msg.reply(lang.ping.pong);
    console.log(lang.ping.pong);
  }
}
