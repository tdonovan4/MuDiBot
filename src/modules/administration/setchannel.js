const bot = require('../../bot.js');
const db = require('../database/database.js');
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
    db.config.updateDefaultChannel(msg.guild.id, botChannel);
    botChannel.send(lang.setchannel.newDefaultChannel);
  }
}
