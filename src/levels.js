const storage = require('./storage.js');
const bot = require('./bot.js');
const mustache = require('mustache');
const sql = require('sqlite');
var lang = require('./localization.js').getLocalization();

function modifyUserXp (msg, userId, value) {
  sql.open('./storage/data.db').then(() => {
    sql.run('CREATE TABLE IF NOT EXISTS users (serverId TEXT, userId TEXT, xp INTEGER, warnings INTEGER)')
      .then(() => {
        sql.run('UPDATE users SET xp = ? WHERE serverId = ? AND userId = ?', [value, msg.guild.id, userId])
          .catch(error => {
            console.log(error);
          });
      }).catch(error => {
        console.log(error);
      });
    sql.close();
  }).catch(error => {
    console.log(error);
  });
}

module.exports = {
  getXpForLevel: function(level) {
    return level ** 1.5 - (level ** 1.5) % 5 + 100
  },
  getProgression: function(remainingXp) {
    level = 1;
    while (remainingXp > this.getXpForLevel(level)) {
      remainingXp -= this.getXpForLevel(level);
      level++;
    }
    return [level, remainingXp];
  },
  newMessage: async function(msg) {
    var xp = await storage.getUser(msg, msg.author.id);
    xp = xp.xp;
    if (xp != undefined) {
      //Add 1 per 2 characters
      var extraXp = Math.trunc(msg.content.replace(/\s/g, "").length / 3);
      //Get a random number from 1 to 3 and add extra xp (max is 20);
      xpGained = Math.min(20, (Math.floor(Math.random() * 3) + 1) + extraXp);
      modifyUserXp(msg, msg.author.id, xp + xpGained);

      let progression = this.getProgression(xp);
      let xpForNextLevel = this.getXpForLevel(progression[0]) - progression[1];

      //Check if user has level up
      if (xpGained > xpForNextLevel) {
        //Level up!
        bot.printMsg(msg, mustache.render(lang.general.member.leveled, {
          msg,
          progression: progression[0] + 1
        }));
      }
    }
  }
}
