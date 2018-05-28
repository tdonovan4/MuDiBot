const bot = require('../../bot.js');
const storage = require('../../storage.js');
const sql = require('sqlite');
const config = require('../../args.js').getConfig()[1];
var lang = require('../../localization.js').getLocalization();

module.exports = {
  SetGroupCommand: class extends bot.Command {
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
  UnsetGroupCommand: class extends bot.Command {
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
  PurgeGroupsCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'purgegroups',
        aliases: ['gpurge'],
        category: 'user',
        priority: 6,
        permLvl: 3
      });
    }
    async execute(msg, args) {
      await purgeGroups(msg);
    }
  },
  setGroup: async function(msg, user, group) {
    var groups = config.groups;

    //Check if there is a user in msg
    if (user == undefined) {
      //Invalid argument: user
      bot.printMsg(msg, lang.error.invalidArg.user);
      return;
    }
    //Check if there is a group in msg
    if (group == undefined) {
      //Missing argument: group
      bot.printMsg(msg, lang.error.missingArg.group);
      return;
    }

    //Put first character of group in uppercase
    group = group.charAt(0).toUpperCase() + group.slice(1);

    //Check if group exists
    if (groups.find(x => x.name == group) != undefined) {
      //Get existing groups
      var row = await storage.getUser(msg, user.id);
      existingGroups = (row.groups != null) ? row.groups.split(',') : [];

      //Check for duplicate
      if (existingGroups.find(x => x == group)) {
        bot.printMsg(msg, lang.error.groupDuplicate);
        return;
      }
      //Open database
      try {
        await sql.open(config.pathDatabase)
      } catch (e) {
        console.error(e);
      }
      if (!row) {
        //Row doesn't exist
        try {
          await sql.run('INSERT INTO users (serverId, userId, xp, warnings, groups) VALUES (?, ?, ?, ?, ?)', [msg.guild.id, user.id, 0, 0, group]);
        } catch (e) {
          console.error(e);
        }
      } else {
        //Update row
        existingGroups.push(group);
        try {
          await sql.run("UPDATE users SET groups = ? WHERE serverId = ? AND userId = ?", [existingGroups.toString(), msg.guild.id, user.id]);
        } catch (e) {
          console.error(e);
        }
      }
      await sql.close();
      bot.printMsg(msg, lang.setgroup.newGroup);
    } else {
      //Group don't exists
      bot.printMsg(msg, lang.error.notFound.group);
    }
  },
  unsetGroup: async function(msg, user, group) {
    var groups = config.groups;

    //Check if there is a user in msg
    if (user == undefined) {
      //Invalid argument: user
      bot.printMsg(msg, lang.error.invalidArg.user);
      return;
    }
    //Check if there is a group in msg
    if (group == undefined) {
      //Missing argument: group
      bot.printMsg(msg, lang.error.missingArg.group);
      return;
    }

    //Put first character of group in uppercase
    group = group.charAt(0).toUpperCase() + group.slice(1);

    //Check if group exists
    if (groups.find(x => x.name == group) != undefined) {
      //Get existing groups
      var row = await storage.getUser(msg, user.id);
      existingGroups = (row.groups != null) ? row.groups.split(',') : [];
      //Open database
      try {
        await sql.open(config.pathDatabase);
      } catch (e) {
        console.error(e);
      }
      if (!row) {
        //Row doesn't exist
        try {
          await sql.run('INSERT INTO users (serverId, userId, xp, warnings, groups) VALUES (?, ?, ?, ?, ?)', [msg.guild.id, user.id, 0, 0, groups[0].name]);
          msg.channel.send(lang.unsetgroup.notInGroup);
        } catch (e) {
          console.error(e);
        }
      } else {
        //Remove group
        let index = existingGroups.indexOf(group);
        if (index > -1) {
          existingGroups.splice(index, 1)
          if (existingGroups.length < 2 && existingGroups[0] == '') {
            //No group
            existingGroups = null;
          } else {
            existingGroups = existingGroups.toString()
          }
          try {
            await sql.run("UPDATE users SET groups = ? WHERE serverId = ? AND userId = ?", [existingGroups, msg.guild.id, user.id]);
            bot.printMsg(msg, lang.unsetgroup.removed);
          } catch (e) {
            console.error(e);
          }
        } else {
          bot.printMsg(msg, lang.unsetgroup.notInGroup);
        }
      }
      await sql.close();
    } else {
      //Group don't exists
      bot.printMsg(msg, lang.error.notFound.group);
    }
  },
}

async function purgeGroups(msg) {
  var user = msg.mentions.users.first();

  //Check if there is a user in msg
  if (user == undefined) {
    //Invalid argument: user
    bot.printMsg(msg, lang.error.invalidArg.user);
    return;
  }
  //Open database
  try {
    await sql.open(config.pathDatabase);
    await sql.run('CREATE TABLE IF NOT EXISTS users (serverId TEXT, userId TEXT, xp INTEGER, warnings INTEGER, groups TEXT)');
    await sql.run('UPDATE users SET groups = null WHERE serverId = ? AND userId = ?', [msg.guild.id, user.id]);
  } catch (e) {
    console.error(e);
  }
  bot.printMsg(msg, lang.purgegroups.purged);
  await sql.close();
}
