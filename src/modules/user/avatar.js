const bot = require('../../bot.js');
var lang = require('../../localization.js').getLocalization();

module.exports = class AvatarCommand extends bot.Command {
  constructor() {
    super({
      name: 'avatar',
      aliases: [],
      category: 'user',
      priority: 10,
      permLvl: 0
    });
  }
  execute(msg) {
    var user = msg.mentions.users.first()
    if (user != undefined && user != null) {
      bot.printMsg(msg, user.avatarURL);
    } else {
      bot.printMsg(msg, lang.error.invalidArg.user);
    }
  }
}
