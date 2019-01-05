const { printMsg } = require('../../util.js');
const commands = require('../../commands.js');
const db = require('../database/database.js');
var lang = require('../../localization.js').getLocalization();

function getRewardInMsg(msg, args) {
  var roleId = args[1].match(/<@&(.*?)>/)
  var role;
  if (roleId != undefined) {
    role = msg.guild.roles.get(roleId[1]);
  }
  var group = args[1].charAt(0).toUpperCase() + args[1].slice(1);
  if (role != null) {
    //Reward is a role
    return role.id;
  } else {
    //Reward is group;
    return group;
  }
}

module.exports = {
  SetRewardCommand: class extends commands.Command {
    constructor() {
      super({
        name: 'setreward',
        aliases: [],
        args: [
          new commands.Argument({
            optional: false,
            interactiveMsg: lang.setreward.interactiveMode.rank,
            type: 'rank',
            missingError: lang.error.missingArg.rank,
            invalidError: lang.error.notFound.rank
          }),
          new commands.Argument({
            optional: false,
            interactiveMsg: lang.setreward.interactiveMode.reward,
            type: 'reward',
            missingError: lang.error.missingArg.reward,
            invalidError: lang.error.invalidArg.reward
          }),
        ],
        category: 'administration',
        priority: 1,
        permLvl: 3
      });
    }
    async execute(msg, args) {
      var rank = args[0];
      var reward = getRewardInMsg(msg, args);
      //Check if there is a reward in msg
      if (reward == undefined) {
        return;
      }
      //Put first character of rank in uppercase
      rank = rank.charAt(0).toUpperCase() + rank.slice(1);
      //Change underscore to space
      rank = rank.replace('_', ' ');
      //Insert reward for rank in database
      await db.reward.updateRankReward(msg.guild.id, rank, reward);
      msg.channel.send(lang.setreward.newReward);
    }
  },
  UnsetRewardCommand: class extends commands.Command {
    constructor() {
      super({
        name: 'unsetreward',
        aliases: [],
        args: [
          new commands.Argument({
            optional: false,
            interactiveMsg: lang.setreward.interactiveMode.rank,
            type: 'rank',
            missingError: lang.error.missingArg.rank,
            invalidError: lang.error.notFound.rank
          })
        ],
        category: 'administration',
        priority: 0,
        permLvl: 3
      });
    }
    async execute(msg, args) {
      var rank = args[0];
      //Put first character of rank in uppercase
      rank = rank.charAt(0).toUpperCase() + rank.slice(1);
      //Change underscore to space
      rank = rank.replace('_', ' ');
      //Check if this rank has a reward
      var reward = await db.reward.getRankReward(msg.guild.id, rank);
      if (reward == null) {
        //Reward not found
        printMsg(msg, lang.error.notFound.rankReward);
        return;
      }
      //Delete reward
      await db.reward.deleteRankReward(msg.guild.id, rank);
      printMsg(msg, lang.unsetreward.rewardUnset);
    }
  }
}
