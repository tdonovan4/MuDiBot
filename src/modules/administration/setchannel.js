const { Command } = require('../../commands.js');
const db = require('../database/database.js');
var lang = require('../../localization.js').getLocalization();

module.exports = class SetChannelCommand extends Command {
  constructor() {
    super({
      name: 'setchannel',
      aliases: [],
      category: 'administration',
      priority: 7,
      permLvl: 3
    });
  }
  async execute(msg) {
    var botChannel = msg.channel;
    //Modify default channel in database
    await db.config.updateDefaultChannel(msg.guild.id, botChannel);
    botChannel.send(lang.setchannel.newDefaultChannel);
  }
}
