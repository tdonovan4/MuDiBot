const commands = require('../../commands.js');
var lang = require('../../localization.js').getLocalization();

module.exports = class AvatarCommand extends commands.Command {
  constructor() {
    super({
      name: 'avatar',
      aliases: [],
      args: [
        new commands.Argument({
          optional: false,
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
  execute(msg) {
    var user = msg.mentions.users.first();
    msg.channel.send(user.avatarURL);
  }
}
