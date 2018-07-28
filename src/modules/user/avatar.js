const commands = require('../../commands.js');
const { getUserFromArg } = require('../../util.js');
var lang = require('../../localization.js').getLocalization();

module.exports = class AvatarCommand extends commands.Command {
  constructor() {
    super({
      name: 'avatar',
      aliases: [],
      args: [
        new commands.Argument({
          optional: false,
          interactiveMsg: lang.avatar.interactiveMode.user,
          type: 'mention',
          missingError: lang.error.missingArg.user,
          invalidError: lang.error.invalidArg.user
        })
      ],
      category: 'user',
      priority: 11,
      permLvl: 0
    });
  }
  execute(msg, args) {
    var user = getUserFromArg(msg, args[0]);
    msg.channel.send(user.avatarURL);
  }
}
