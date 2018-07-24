const commands = require('../../commands.js');
var lang = require('../../localization.js').getLocalization();

module.exports = class SayCommand extends commands.Command {
  constructor() {
    super({
      name: 'say',
      aliases: [],
      args: [
        new commands.Argument({
          optional: true,
          type: 'channel',
        }),
        new commands.Argument({
          position: 1,
          optional: false,
          missingError: lang.error.missingArg.message
        })
      ],
      category: 'general',
      priority: 0,
      permLvl: 3
    });
  }
  execute(msg, args) {
    let channel;
    let id = args[0].match(/<#(.*?)>/);
    //Try to find which channel to send message
    if (id != null && msg.guild.channels.has(id[1])) {
      //Use provided channel
      channel = msg.guild.channels.get(id[1]);
      //Remove channel from list of args
      args = args.slice(1);
    } else {
      //Use current channel
      channel = msg.channel;
    }
    //Send message
    channel.send(args.join(' '));
  }
}
