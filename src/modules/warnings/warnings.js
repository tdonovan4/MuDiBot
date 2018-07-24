//Handle warnings
const db = require('../database/database.js');
const { printMsg } = require('../../util.js');
const commands = require('../../commands.js');
const mustache = require('mustache');
var lang = require('../../localization.js').getLocalization();

module.exports = {
  WarnCommand: class extends commands.Command {
    constructor() {
      super({
        name: 'warn',
        aliases: [],
        args: [
          new commands.Argument({
            optional: false,
            type: 'mention',
            missingError: lang.error.missingArg.user,
            invalidError: lang.error.invalidArg.user
          }),
        ],
        category: 'warnings',
        priority: 10,
        permLvl: 2
      });
    }
    async execute(msg) {
      await module.exports.warn(msg, 1);
    }
  },
  UnwarnCommand: class extends commands.Command {
    constructor() {
      super({
        name: 'unwarn',
        aliases: [],
        args: [
          new commands.Argument({
            optional: false,
            type: 'mention',
            missingError: lang.error.missingArg.user,
            invalidError: lang.error.invalidArg.user
          }),
        ],
        category: 'warnings',
        priority: 9,
        permLvl: 2
      });
    }
    async execute(msg) {
      await module.exports.warn(msg, -1);
    }
  },
  WarnListCommand: class extends commands.Command {
    constructor() {
      super({
        name: 'warnlist',
        aliases: [],
        args: [
          new commands.Argument({
            optional: true,
            type: 'mention',
            failOnInvalid: true,
            invalidError: lang.error.invalidArg.user
          }),
        ],
        category: 'warnings',
        priority: 8,
        permLvl: 1
      });
    }
    async execute(msg, args) {
      var mention = msg.mentions.users.first();
      console.log(args);
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
        printMsg(msg, output);
      } else if (mention != undefined) {
        //List the user's warnings
        var warnings = await db.user.getWarnings(msg.guild.id, mention.id);

        printMsg(msg, mustache.render(lang.warn.list, {
          userId: mention.id,
          warning: warnings
        }));
      } else {
        printMsg(msg, lang.error.usage);
      }
    }
  },
  WarnPurgeCommand: class extends commands.Command {
    constructor() {
      super({
        name: 'warnpurge',
        aliases: [],
        args: [
          new commands.Argument({
            optional: true,
            type: 'mention',
          }),
          new commands.Argument({
            optional: true,
            possibleValues: ['all'],
            failOnInvalid: true,
            invalidError: lang.error.invalidArg.user
          }),
        ],
        category: 'warnings',
        priority: 7,
        permLvl: 2
      });
    }
    async execute(msg, args) {
      if (args == 'all') {
        //Purge all users
        await db.user.updateUsersWarnings(msg.guild.id, 0);
        printMsg(msg, lang.warn.usersCleared);
      } else if (msg.mentions.users.first() != undefined) {
        //Purge the user
        var mention = msg.mentions.users.first();
        var userExists = await db.user.exists(msg.guild.id, mention.id);

        if (userExists) {
          await db.user.updateUsersWarnings(msg.guild.id, 0);
          printMsg(msg, lang.warn.userCleared);
        } else {
          printMsg(msg, lang.error.invalidArg.user);
        }
      } else {
        printMsg(msg, lang.error.usage);
      }
    }
  },
  warn: async function(msg, num) {
    var mention = msg.mentions.users.first();
    var warnings = await db.user.getWarnings(msg.guild.id, mention.id);
    if (warnings == undefined) {
      //Default
      warnings = 0;
    }
    //User warnings found!
    warnings += num;
    await db.user.updateWarnings(msg.guild.id, mention.id, warnings);
    printMsg(msg, mustache.render(lang.warn.list, {
      userId: mention.id,
      warning: warnings
    }));
  }
}
