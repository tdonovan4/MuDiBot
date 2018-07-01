const bot = require('./bot.js');
const mustache = require('mustache');
const permGroups = require('./modules/user/permission-group.js');
const db = require('./modules/database/database.js');
const config = require('./args.js').getConfig()[1];
const lastMessages = [];
var lang = require('./localization.js').getLocalization();
var maxValue = 1000;

//Ranks are in order, the lowest first
var ranks = [{
    //Vagabond
    name: lang.ranks.vagabond,
    color: 0x808080
  },
  {
    //Farmer
    name: lang.ranks.farmer,
    color: 0xffff3c
  },
  {
    //Warrior
    name: lang.ranks.warrior,
    color: 0xff3333
  },
  {
    //Lord
    name: lang.ranks.lord,
    color: 0x3c3cff
  },
  {
    //King
    name: lang.ranks.king,
    color: 0xffaa00
  },
  {
    //Emperor
    name: lang.ranks.emperor,
    color: 0x8c1aff
  },
  {
    //XP Master
    name: lang.ranks.xpMaster,
    color: 0x00ff40
  },
  {
    //Spam Master
    name: lang.ranks.spamMaster,
    color: 0xff3c9d
  },
  {
    //XP God
    name: lang.ranks.xpGod,
    color: 0x00ff00
  },
  {
    //Spam God
    name: lang.ranks.spamGod,
    color: 0xff0080
  },
];

var lastRank = {
  name: lang.ranks.lastRank,
  color: 0xff0000
}

async function addReward(msg, reward) {
  if (config.groups.find(x => x.name == reward) != undefined) {
    //Reward is a group
    await permGroups.setGroup(msg, msg.author, reward)
    return reward;
  } else {
    //Add role
    msg.member.addRole(reward, lang.general.member.addReward).catch(error => {
      console.log(error);
    });
    return msg.guild.roles.get(reward).name;
  }
}

module.exports = {
  ranks: ranks,
  getXpForLevel: function(level) {
    return level ** 1.5 - (level ** 1.5) % 5 + 100
  },
  getProgression: function(remainingXp) {
    var totalLevel = 1;
    var realLevel = totalLevel;

    while (remainingXp >= this.getXpForLevel(realLevel)) {
      remainingXp -= this.getXpForLevel(realLevel);
      totalLevel++;
      realLevel = totalLevel - Math.floor(totalLevel / 100) * 100
      //Check if level is egal to max value
      if (totalLevel == maxValue) {
        return [realLevel, 0, maxValue];
      }
    }
    return [realLevel, remainingXp, totalLevel];
  },
  getRank: function(level) {
    var prestige = Math.floor(level / 100);
    //Remove prestige from the total level
    level -= prestige * 100

    //Check if level is under max value
    var rank = (level < maxValue) ? ranks[Math.floor(level / 10)] : lastRank;
    //Check if rank exists
    if (rank == undefined) {
      console.log(lang.error.notFound.rank);
      return [undefined, prestige];
    }
    //Check if name is localized
    if (rank.name == undefined) {
      console.log(lang.error.notLocalized.rank);
      return [undefined, prestige];
    }

    //Return rank and prestige
    return [rank.name, prestige, rank.color]
  },
  newMessage: async function(msg) {
    var userLastMessage = lastMessages.find(x => x.author == msg.author.id);
    var currentTime = Date.now();

    if (userLastMessage == undefined) {
      userLastMessage = {
        time: 0
      };
      //Add user
      lastMessages.push({
        author: msg.author.id,
        time: currentTime
      })
    }

    //Check if user is spamming
    if (currentTime - userLastMessage.time < config.levels.cooldown) {
      return;
    }

    if (lastMessages.indexOf(userLastMessage) > -1) {
      //Remove old message
      lastMessages.splice(lastMessages.indexOf(userLastMessage), 1)
      //Reset time last message
      lastMessages.push({
        author: msg.author.id,
        time: currentTime
      })
    }

    var xp = await db.user.getXP(msg.guild.id, msg.author.id);
    if (xp != undefined) {
      //Add 1 per 2 characters
      var extraXp = Math.trunc(msg.content.replace(/\s/g, "").length / 3);
      //Get a random number from 1 to 3 and add extra xp (max is 20);
      var xpGained = Math.min(20, (Math.floor(Math.random() * 3) + 1) + extraXp);
      await db.user.updateXP(msg.guild.id, msg.author.id, xp + xpGained);

      let progression = this.getProgression(xp);
      let xpForNextLevel = this.getXpForLevel(progression[0]) - progression[1];
      //Check if user has level up
      if (xpGained >= xpForNextLevel) {
        //Level up!
        var message = mustache.render(lang.general.member.leveled, {
          msg,
          progression: progression[0] + 1
        });
        //Check if users has ranked up
        if ((progression[0] + 1) % 10 == 0) {
          var rank = this.getRank(progression[2] + 1)
          message += '\n' + mustache.render(lang.general.member.rankUp, {
            rank: `${rank[0]}${(rank[1] > 0) ? ` (${rank[1]}:star:)` : ''}`
          });
          var reward = await db.reward.getRankReward(msg.guild.id, rank[0]);
          if (reward != undefined) {
            //Reward found for this rank
            let name = await addReward(msg, reward);
            message += ' ' + mustache.render(lang.general.member.reward, {
              role: name
            });
            //Check if the removal of the old role is enabled
            if (config.levels.removeOldRole == true) {
              var oldRole = await db.reward.getRankReward(msg.guild.id, this.getRank(progression[2]));
              if (oldRole != undefined) {
                msg.member.removeRole(oldRole, lang.general.member.removeOldReward).catch(error => {
                  console.log(error);
                });
              }
            }
          } else {
            //TODO: maybe remove
            bot.printMsg(msg, lang.error.notFound.rankReward);
          }
          //Add exclamation mark at the end
          message += '!';
        }
        bot.printMsg(msg, message);
      }
    }
  }
}
