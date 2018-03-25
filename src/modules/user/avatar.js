const bot = require('../../bot.js');
var lang = require('../../localization.js').getLocalization();

module.exports = class avatarCommand extends bot.Command {
  constructor() {
    super({
      name: 'avatar',
      aliases: [],
      category: 'user',
      permLvl: 0
    });
  }
  execute(msg, args) {
    var user = msg.mentions.users.first()
    if (user != undefined && user != null) {
      bot.printMsg(msg, user.avatarURL);
    } else {
      bot.printMsg(msg, lang.error.invalidArg.user);
    }
  }
}
