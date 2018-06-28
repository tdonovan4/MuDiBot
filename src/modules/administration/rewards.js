const bot = require('../../bot.js');
const levels = require('../../levels.js');
const db = require('../database/database.js');
const config = require('../../args.js').getConfig()[1];
var lang = require('../../localization.js').getLocalization();

function getRewardInMsg(msg, args) {
  var role = msg.mentions.roles.first();
  if (args[1] == undefined) {
    bot.printMsg(msg, lang.error.missingArg.reward);
    return;
  }
  var group = args[1].charAt(0).toUpperCase() + args[1].slice(1);

  //Check if reward is a role
  if (role != null) {
    if (msg.guild.roles.has(role.id)) {
      //Reward is a role
      return role.id;
    }
  } else if (group == null) { //Check if reward is a group
    //No reward
    bot.printMsg(msg, lang.error.missingArg.reward);
    return;
  } else if (config.groups.find(x => x.name == group) != undefined) {
    //Reward is group;
    return group;
  }
  bot.printMsg(msg, lang.error.invalidArg.reward);
  return;
}

module.exports = {
  SetRewardCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'setreward',
        aliases: [],
        category: 'administration',
        priority: 1,
        permLvl: 3
      });
    }
    async execute(msg, args) {
      var rank = args[0];
      //Check if there is a rank in msg
      if (rank == undefined) {
        //Missing argument: rank
        bot.printMsg(msg, lang.error.missingArg.rank);
        return;
      }
      var reward = getRewardInMsg(msg, args);
      //Check if there is a reward in msg
      if (reward == undefined) {
        return;
      }
      //Put first character of rank in uppercase
      rank = rank.charAt(0).toUpperCase() + rank.slice(1);

      //Check if rank exists
      if (levels.ranks.find(x => x.name == rank) != undefined) {
        //Insert reward for rank in database
        await db.rewards.updateRankReward(msg.guild.id, rank, reward);
        msg.channel.send(lang.setreward.newReward);
      } else {
        //Rank don't exists
        bot.printMsg(msg, lang.error.notFound.rank);
      }
    }
  },
  UnsetRewardCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'unsetreward',
        aliases: [],
        category: 'administration',
        priority: 0,
        permLvl: 3
      });
    }
    async execute(msg, args) {
      var rank = args[0];
      //Check if there is a rank in msg
      if (rank == undefined) {
        //Missing argument: rank
        bot.printMsg(msg, lang.error.missingArg.rank);
        return;
      }
      //Put first character of rank in uppercase
      rank = rank.charAt(0).toUpperCase() + rank.slice(1);
      //Check if it's a valid rank
      if (levels.ranks.find(x => x.name == rank) == undefined) {
        bot.printMsg(msg, lang.error.notFound.rank);
        return;
      }
      //Check if this rank as a reward
      var reward = await db.rewards.getRankReward(msg.guild.id, rank);
      if (reward == null) {
        //Reward not found
        bot.printMsg(msg, lang.error.notFound.rankReward);
        return;
      }
      //Delete reward
      await db.rewards.deleteRankReward(msg.guild.id, rank);
      bot.printMsg(msg, lang.unsetreward.rewardUnset);
    }
  }
}
