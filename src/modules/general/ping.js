const bot = require('../../bot.js');
var lang = require('../../localization.js').getLocalization();

module.exports = class pingCommand extends bot.Command {
  constructor() {
    super({
      name: 'ping',
      aliases: [],
      category: 'general',
      permLvl: 0
    });
  }
  execute(msg) {
    msg.reply(lang.ping.pong);
    console.log(lang.ping.pong);
  }
}
