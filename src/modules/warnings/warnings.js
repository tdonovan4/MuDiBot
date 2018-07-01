//Handle warnings
const db = require('../database/database.js');
const bot = require('../../bot.js');
const mustache = require('mustache');
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
    execute(msg) {
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
    execute(msg) {
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
        var users = await db.user.getUsersWarnings(msg.guild.id);
        var output = '';
        for (var i = 0; i < users.length; i++) {
          if (users[i].warning > 0) {
            if (output.length > 0) {
              output += '\n';
            }
            output += mustache.render(lang.warn.list, {
              userId: users[i].user_id,
              warning: users[i].warning
            });
          }
        }
        if (output === '') {
          output = lang.warn.noWarns;
        }
        bot.printMsg(msg, output);
      } else if (mention != undefined) {
        //List the user's warnings
        var warnings = await db.user.getWarnings(msg.guild.id, mention.id);

        bot.printMsg(msg, mustache.render(lang.warn.list, {
          userId: mention.id,
          warning: warnings
        }));
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
        await db.user.updateUsersWarnings(msg.guild.id, 0);
        bot.printMsg(msg, lang.warn.usersCleared);
      } else if (msg.mentions.users.first() != undefined) {
        //Purge the user
        var mention = msg.mentions.users.first();
        var userExists = await db.user.exists(msg.guild.id, mention.id);

        if (userExists) {
          await db.user.updateUsersWarnings(msg.guild.id, 0);
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
      var warnings = await db.user.getWarnings(msg.guild.id, mention.id);
      if (warnings == undefined) {
        //Default
        warnings = 0;
      }
      //User warnings found!
      warnings += num;
      await db.user.updateWarnings(msg.guild.id, mention.id, warnings);
      bot.printMsg(msg, mustache.render(lang.warn.list, {
        warnings: warnings
      }));
    } else {
      bot.printMsg(msg, lang.error.usage);
    }
  }
}
