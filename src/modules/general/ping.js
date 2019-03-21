const { Command } = require('../../commands.js');
const mustache = require('mustache');
const { client } = require('discord.js');
var lang = require('../../localization.js').getLocalization();

module.exports = class PingCommand extends Command {
  constructor() {
    super({
      name: 'ping',
      aliases: [],
      category: 'general',
      priority: 9,
      permLvl: 0
    });
  }
  execute(msg) {
    let ping = new Date() - msg.createdAt;
    let heartbeatPing = client.ping;
    let response = mustache.render(lang.ping.pong, { ping, heartbeatPing });
    msg.reply(response);
    console.log(response);
  }
}
