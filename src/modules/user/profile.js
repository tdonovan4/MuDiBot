const Discord = require("discord.js");
const bot = require('../../bot.js');
const db = require('../database/database.js');
const levels = require('../../levels.js');
const mustache = require('mustache');
var config = require('../../args.js').getConfig()[1];
var lang = require('../../localization.js').getLocalization();

module.exports = class ProfileCommand extends bot.Command {
  constructor() {
    super({
      name: 'profile',
      aliases: [],
      category: 'user',
      priority: 9,
      permLvl: 0
    });
  }
  async execute(msg) {
    let user = msg.mentions.users.first();
    if (user == undefined) {
      //There is no mentions
      user = msg.author;
    }

    let userData = await db.users.user.getAll(msg.guild.id, user.id);
    let progression = levels.getProgression(userData.xp);
    let level = progression[0];
    let xpToNextLevel = `${progression[1]}/${levels.getXpForLevel(level)}`;
    let rank = levels.getRank(progression[2]);
    let groups = ['Ø'];

    //Get groups
    if(userData.groups != null) {
      groups = userData.groups.split(',').sort(function(a, b) {
        return config.groups.find(x => x.name == a).permLvl <
          config.groups.find(x => x.name == b).permLvl;
      });
    }

    //If user is a superuser, add that to groups
    if(config.superusers.find(x => x == user.id) != null) {
      groups.unshift('Superuser');
    }

    //Put newline at every 4 groups
    for(let i = 3; i < groups.length; i += 3) {
      groups[i] = '\n' + groups[i];
    }

    var embed = new Discord.RichEmbed();
    embed.title = mustache.render(lang.profile.title, user);
    embed.color = rank[2];
    embed.setThumbnail(user.avatarURL)
    embed.addField(lang.profile.rank,
      `${rank[0]} ${(rank[1] > 0) ? `(${rank[1]}:star:)` : ''}`, true)
    embed.addField(lang.profile.groups, groups.join(', '), true)
    embed.addField(lang.profile.level, `${level} (${xpToNextLevel})`, false)
    embed.addField(lang.profile.xp, userData.xp, true)
    embed.addField(lang.profile.warnings, userData.warnings, true)
    embed.setFooter(mustache.render(lang.profile.footer, user))
    msg.channel.send({
      embed
    });
  }
}
