const { printMsg } = require('../../util.js');
const { Command } = require('../../commands.js');
const db = require('../database/database.js');
const config = require('../../util.js').getConfig()[1];
var lang = require('../../localization.js').getLocalization();

module.exports = {
  SetGroupCommand: class extends Command {
    constructor() {
      super({
        name: 'setgroup',
        aliases: [],
        category: 'user',
        priority: 8,
        permLvl: 3
      });
    }
    async execute(msg, args) {
      await module.exports.setGroup(msg, msg.mentions.users.first(), args[1]);
    }
  },
  UnsetGroupCommand: class extends Command {
    constructor() {
      super({
        name: 'unsetgroup',
        aliases: ['ungroup'],
        category: 'user',
        priority: 7,
        permLvl: 3
      });
    }
    async execute(msg, args) {
      await module.exports.unsetGroup(msg, msg.mentions.users.first(), args[1]);
    }
  },
  PurgeGroupsCommand: class extends Command {
    constructor() {
      super({
        name: 'purgegroups',
        aliases: ['gpurge'],
        category: 'user',
        priority: 6,
        permLvl: 3
      });
    }
    async execute(msg) {
      await purgeGroups(msg);
    }
  },
  setGroup: async function(msg, user, group) {
    var groups = config.groups;

    //Check if there is a user in msg
    if (user == undefined) {
      //Invalid argument: user
      printMsg(msg, lang.error.invalidArg.user);
      return;
    }
    //Check if there is a group in msg
    if (group == undefined) {
      //Missing argument: group
      printMsg(msg, lang.error.missingArg.group);
      return;
    }

    //Put first character of group in uppercase
    group = group.charAt(0).toUpperCase() + group.slice(1);

    //Check if group exists
    if (groups.find(x => x.name == group) != undefined) {
      //Get existing groups
      var userGroups = await db.user.getPermGroups(msg.guild.id, msg.author.id);
      //Split groups
      userGroups = userGroups.split(',');
      //Remove whitespace
      userGroups = userGroups.filter(e => String(e).trim());
      //Check for duplicate
      if (userGroups.find(x => x == group)) {
        printMsg(msg, lang.error.groupDuplicate);
        return;
      }
      //Update row
      userGroups.push(group);
      await db.user.updatePermGroups(msg.guild.id, user.id, userGroups.toString());
      printMsg(msg, lang.setgroup.newGroup);
    } else {
      //Group don't exists
      printMsg(msg, lang.error.notFound.group);
    }
  },
  unsetGroup: async function(msg, user, group) {
    var groups = config.groups;

    //Check if there is a user in msg
    if (user == undefined) {
      //Invalid argument: user
      printMsg(msg, lang.error.invalidArg.user);
      return;
    }
    //Check if there is a group in msg
    if (group == undefined) {
      //Missing argument: group
      printMsg(msg, lang.error.missingArg.group);
      return;
    }

    //Put first character of group in uppercase
    group = group.charAt(0).toUpperCase() + group.slice(1);

    //Check if group exists
    if (groups.find(x => x.name == group) != undefined) {
      //Get existing groups
      var userGroups = await db.user.getPermGroups(msg.guild.id, msg.author.id);
      //Split groups
      userGroups = userGroups.split(',');
      //Remove group
      let index = userGroups.indexOf(group);
      if (index > -1) {
        userGroups.splice(index, 1);
        if (userGroups.length < 2 && userGroups[0] == '') {
          //No group
          userGroups = config.groups[0].name;
        } else {
          userGroups = userGroups.toString()
        }
        await db.user.updatePermGroups(msg.guild.id, user.id, userGroups);
        printMsg(msg, lang.unsetgroup.removed);
      } else {
        printMsg(msg, lang.unsetgroup.notInGroup);
      }
    } else {
      //Group don't exists
      printMsg(msg, lang.error.notFound.group);
    }
  },
}

async function purgeGroups(msg) {
  var user = msg.mentions.users.first();

  //Check if there is a user in msg
  if (user == undefined) {
    //Invalid argument: user
    printMsg(msg, lang.error.invalidArg.user);
    return;
  }
  //Back to default group
  await db.user.updatePermGroups(msg.guild.id, user.id, config.groups[0].name);
  printMsg(msg, lang.purgegroups.purged);
}
