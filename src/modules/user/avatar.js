const { printMsg } = require('../../util.js');
const { Command } = require('../../commands.js');
var lang = require('../../localization.js').getLocalization();

module.exports = class AvatarCommand extends Command {
  constructor() {
    super({
      name: 'avatar',
      aliases: [],
      category: 'user',
      priority: 11,
      permLvl: 0
    });
  }
  execute(msg) {
    var user = msg.mentions.users.first()
    if (user != undefined && user != null) {
      printMsg(msg, user.avatarURL);
    } else {
      printMsg(msg, lang.error.invalidArg.user);
    }
  }
}
