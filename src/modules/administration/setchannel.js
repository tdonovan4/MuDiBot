const bot = require('../../bot.js');
const defaultChannel = require('../../default-channel.js');
var lang = require('../../localization.js').getLocalization();

module.exports = class SetChannelCommand extends bot.Command {
  constructor() {
    super({
      name: 'setchannel',
      aliases: [],
      category: 'administration',
      priority: 7,
      permLvl: 3
    });
  }
  execute(msg, args) {
    var botChannel = msg.channel;
    //Modify default channel in database
    defaultChannel.setChannel(msg, botChannel);
    botChannel.send(lang.setchannel.newDefaultChannel);
  }
}
