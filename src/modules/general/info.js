const Discord = require("discord.js");
const config = require('../../util.js').getConfig()[1];
const { Command } = require('../../commands.js');
const { client } = require('discord.js');
var lang = require('../../localization.js').getLocalization();
var pjson = require('../../../package.json');

module.exports = class InfoCommand extends Command {
  constructor() {
    super({
      name: 'info',
      aliases: [],
      category: 'general',
      priority: 8,
      permLvl: 0
    });
  }
  execute(msg) {
    var info = lang.info;

    var embed = new Discord.RichEmbed();
    embed.title = `__**${info.title}**__`;
    embed.color = 0x0080c0;
    embed.addField(`**${info.general.title}**`,
      `**${info.general.name}:** ${pjson.name}
      **${info.general.desc}:** ${pjson.description}
      **${info.general.author}:** ${pjson.author}
      **${info.general.version}:** ${pjson.version}
      **${info.general.uptime}:** ${time()}`.replace(/^( *)/gm, ''), false);
    embed.addField(`**${info.config.title}**`,
      `**${info.config.language}:** ${config.locale}`.replace(/^( *)/gm, ''), false)
    embed.setFooter(`${info.footer.clientId}: ${client.user.id}`)
    msg.channel.send({
      embed
    });
  }
}

//Format time
function time() {
  var time = process.uptime();
  var days = ~~(time / 86400)
  var hrs = ~~((time % 86400) / 3600);
  var mins = ~~((time % 3600) / 60);
  var secs = ~~(time % 60);
  return days + 'd:' + hrs + 'h:' + mins + 'm:' + secs + 's'
}
