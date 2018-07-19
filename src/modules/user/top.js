const Discord = require("discord.js");
const mustache = require('mustache');
const { Command } = require('../../commands.js');
const { client } = require('discord.js');
const db = require('../database/database.js');
const levels = require('../../levels.js');
var lang = require('../../localization.js').getLocalization();

module.exports = class TopCommand extends Command {
  constructor() {
    super({
      name: 'top',
      aliases: ['leaderboard'],
      category: 'user',
      priority: 1,
      permLvl: 0
    });
  }
  async execute(msg) {
    //Start measuring time
    var start = process.hrtime();
    //Get leaderboards
    var localTop = await getInfo(await db.leaderboard.getLocalTop(msg.guild.id, 10));
    var globalTop = await getInfo(await db.leaderboard.getGlobalTop(10));
    //Get user counts
    var localCount = await db.user.getLocalCount(msg.guild.id);
    var globalCount = await db.user.getGlobalCount();
    //Create embed
    var embed = new Discord.RichEmbed();
    embed.title = lang.top.title;
    embed.color = 0xF5223B;
    //Local
    embed.addField(lang.top.local, printTop(localTop) +
      mustache.render(lang.top.count, {
        count: localCount
      }), true);
    embed.addField(lang.top.global, printTop(globalTop) +
      mustache.render(lang.top.count, {
        count: globalCount
      }), true);
    //Time it took
    var end = process.hrtime(start);
    var took = end[0] * 1000 + end[1] / 1000000;
    embed.setFooter(mustache.render(lang.top.footer, {
      time: took.toFixed(2)
    }));
    msg.channel.send(embed);
  }
}

function printTop(users) {
  var text = '';
  for (var i = 0; i < users.length; i++) {
    var user = users[i];
    var medal = '';
    switch (i) {
      case 0:
        medal = '🥇';
        break;
      case 1:
        medal = '🥈';
        break;
      case 2:
        medal = '🥉';
        break;
    }
    text += `**${i + 1}. ${user.username} ${medal}**\n` +
      mustache.render(lang.top.experience, user);
  }
  return text;
}

async function getInfo(users) {
  var discordUsers = [];
  //Fetch users
  for (var user of users) {
    discordUsers.push(client.fetchUser(user.user_id));
  }
  await Promise.all(discordUsers);
  for (user of users) {
    if (client.users.has(user.user_id)) {
      //Get name
      user.username = client.users.get(user.user_id).username;
    } else {
      //User not found
      console.log(lang.error.notFound.user);
    }
    //Get progession
    var progression = levels.getProgression(user.xp);
    user.level = progression[0];
  }
  return users;
}
