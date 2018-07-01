const Discord = require("discord.js");
const bot = require('../../bot.js');
const sql = require('sqlite');
const config = require('../../args.js').getConfig()[1];
const levels = require('../../levels.js');
const mustache = require('mustache');
var client = bot.client();
var lang = require('../../localization.js').getLocalization();

module.exports = class TopCommand extends bot.Command {
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
    var tops = await getTops(msg, 10);
    //Get counts
    var usersCount = await getUsersCount(msg);
    //Create embed
    var embed = new Discord.RichEmbed();
    embed.title = lang.top.title;
    embed.color = 0xF5223B;
    //Local
    embed.addField(lang.top.local, printTop(tops.local) +
      mustache.render(lang.top.count, {
        count: usersCount.local['COUNT(userId)']
      }), true);
    embed.addField(lang.top.global, printTop(tops.global) +
      mustache.render(lang.top.count, {
        count: usersCount.global['COUNT(DISTINCT userId)']
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

async function getUsersCount(msg) {
  try {
    //Open database
    await sql.open(config.pathDatabase);
    var usersCount = {};
    usersCount.local = await sql.get('SELECT COUNT(user_id) FROM user WHERE server_id = ?', msg.guild.id);
    usersCount.global = await sql.get('SELECT COUNT(DISTINCT user_id) FROM user');
    //Close database
    await sql.close();
  } catch (e) {
    console.log(e);
  }
  return usersCount;
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

async function getTops(msg, num) {
  try {
    //Open database
    await sql.open(config.pathDatabase);
    var tops = {};
    //Get top of this server using limit
    tops.local = await sql.all('SELECT user_id, xp FROM user WHERE server_id = ? ORDER BY xp DESC LIMIT ?', [msg.guild.id, num]);
    tops.local = await getInfo(tops.local);
    //Get top of all users
    tops.global = await sql.all('SELECT user_id, SUM(xp) FROM user GROUP BY user_id ORDER BY SUM(xp) DESC LIMIT ?', [num]);
    //Convert SUM(xp) to xp
    for (var user of tops.global) {
      user.xp = user['SUM(xp)'];
      delete user['SUM(xp)'];
    }
    tops.global = await getInfo(tops.global);
    //Close database
    await sql.close();
  } catch (e) {
    console.log(e);
  }
  return tops;
}
