const { Command } = require('../../commands.js');
const { client } = require('discord.js');
var lang = require('../../localization.js').getLocalization();

module.exports = class SayCommand extends Command {
  constructor() {
    super({
      name: 'say',
      aliases: [],
      category: 'general',
      priority: 0,
      permLvl: 3
    });
  }
  execute(msg, args) {
    let channel;

    //Try to find which channel to send message
    if (args[0] == 'here') {
      channel = msg.channel;
    } else {
      let id = args[0].match(/<#(.*?)>/);
      if (id != null) {
        channel = client.channels.get(id[1]);
      }
    }

    args = args.slice(1).join(' ');

    //Check arguments
    if (channel == undefined) {
      channel = msg.channel;
      args = lang.error.missingArg.channel;
    }

    if (args == undefined || args == '') {
      args = lang.error.missingArg.message;
    }

    //Send message
    channel.send(args);
  }
}
