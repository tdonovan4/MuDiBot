//Handle warnings
const userDB = require('../user/user-db.js');
const bot = require('../../bot.js');
const mustache = require('mustache');
const sql = require('sqlite');
const config = require('../../args.js').getConfig()[1];
var lang = require('../../localization.js').getLocalization();

module.exports = {
  WarnCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'warn',
        aliases: [],
        category: 'warnings',
        priority: 10,
        permLvl: 2
      });
    }
    execute(msg, args) {
      module.exports.warn(msg, 1);
    }
  },
  UnwarnCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'unwarn',
        aliases: [],
        category: 'warnings',
        priority: 9,
        permLvl: 2
      });
    }
    execute(msg, args) {
      module.exports.warn(msg, -1);
    }
  },
  WarnListCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'warnlist',
        aliases: [],
        category: 'warnings',
        priority: 8,
        permLvl: 1
      });
    }
    async execute(msg, args) {
      var mention = msg.mentions.users.first();
      if (args.length == 0) {
        //List all users warnings
        var users = await userDB.users.getWarnings(msg.guild.id);

        var output = '';
        for (i = 0; i < users.length; i++) {
          if (users[i].warnings > 0) {
            if (output.length > 0) {
              output += '\n';
            }
            output += mustache.render(lang.warn.list, users[i]);
          }
        }
        if (output === '') {
          output = lang.warn.noWarns;
        }
        bot.printMsg(msg, output);
      } else if (mention != undefined) {
        //List the user's warnings
        var warnings = await userDB.user.getWarnings(msg.guild.id, mention.id);

        if (user != undefined) {
          bot.printMsg(msg, mustache.render(lang.warn.list, {
            userId: mention.id,
            warnings: warnings
          }));
        } else {
          bot.printMsg(msg, lang.error.invalidArg.user);
        }
      } else {
        bot.printMsg(msg, lang.error.usage);
      }
    }
  },
  WarnPurgeCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'warnpurge',
        aliases: [],
        category: 'warnings',
        priority: 7,
        permLvl: 2
      });
    }
    async execute(msg, args) {
      if (args == 'all') {
        //Purge all users
        await modifyUsersWarnings(msg, 0)
        bot.printMsg(msg, lang.warn.usersCleared);
      } else if (msg.mentions.users.first() != undefined) {
        //Purge the user
        var mention = msg.mentions.users.first();
        var userExists = await userDB.user.exists(msg.guild.id, mention.id);

        if (userExists) {
          await modifyUserWarnings(msg, mention.id, 0)
          bot.printMsg(msg, lang.warn.userCleared);
        } else {
          bot.printMsg(msg, lang.error.invalidArg.user);
        }
      } else {
        bot.printMsg(msg, lang.error.usage);
      }
    }
  },
  warn: async function(msg, num) {
    var mention = msg.mentions.users.first();
    if (mention != undefined) {
      //There is a mention
      var warnings = await userDB.user.getWarnings(msg.guild.id, mention.id);
      if (warnings == undefined) {
        //Default
        warnings = 0;
      }
      //User warnings found!
      warnings += num;
      await modifyUserWarnings(msg, mention.id, warnings);
      bot.printMsg(msg, mustache.render(lang.warn.list, {
        warnings: warnings
      }));
    } else {
      bot.printMsg(msg, lang.error.usage);
    }
  }
}

async function modifyUsersWarnings(msg, value) {
  try {
    await sql.open(config.pathDatabase);
    await sql.run('CREATE TABLE IF NOT EXISTS users (serverId TEXT, userId TEXT, xp INTEGER, warnings INTEGER, groups TEXT)')
    await sql.run('UPDATE users SET warnings = ? WHERE serverId = ?', [value, msg.guild.id]);
    await sql.close();
  } catch (e) {
    console.error(e);
  }
}

async function modifyUserWarnings(msg, userId, value) {
  try {
    var userExists = await userDB.user.exists(msg.guild.id, userId);
    await sql.open(config.pathDatabase);
    await sql.run('CREATE TABLE IF NOT EXISTS users (serverId TEXT, userId TEXT, xp INTEGER, warnings INTEGER, groups TEXT)');
    if (userExists) {
      //User exists, update
      await sql.run('UPDATE users SET warnings = ? WHERE serverId = ? AND userId = ?', [value, msg.guild.id, userId]);
    } else {
      //Insert user
      await sql.run('INSERT INTO users (serverId, userId, xp, warnings, groups) VALUES (?, ?, ?, ?, ?)', [msg.guild.id, userId, 0, value, config.groups[0]]);
    }
    await sql.close();
  } catch (e) {
    console.error(e);
  }
}
