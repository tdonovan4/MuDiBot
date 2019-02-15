//Handle warnings
const db = require('../database/database.js');
const util = require('../../util.js');
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
            interactiveMsg: lang.warn.interactiveMode.user,
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
    async execute(msg, args) {
      var user = util.getUserFromArg(msg, args[0]);
      await module.exports.warn(msg, user, 1);
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
            interactiveMsg: lang.warn.interactiveMode.user,
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
    async execute(msg, args) {
      var user = util.getUserFromArg(msg, args[0]);
      await module.exports.warn(msg, user, -1);
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
      var user = msg.mentions.users.first();
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
        util.printMsg(msg, output);
      } else if (user != undefined) {
        //List the user's warnings
        var warnings = await db.user.getWarnings(msg.guild.id, user.id);

        util.printMsg(msg, mustache.render(lang.warn.list, {
          userId: user.id,
          warning: warnings
        }));
      } else {
        util.printMsg(msg, lang.error.usage);
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
            interactiveMsg: lang.warn.interactiveMode.all,
            possibleValues: ['all'],
            breakOnValid: true
          }),
          new commands.Argument({
            optional: false,
            interactiveMsg: lang.warn.interactiveMode.user,
            type: 'mention',
            failOnInvalid: true,
            invalidError: lang.error.invalidArg.user
          })
        ],
        category: 'warnings',
        priority: 7,
        permLvl: 2
      });
    }
    async execute(msg, args) {
      if (args[0] == 'all') {
        //Purge all users
        await db.user.updateUsersWarnings(msg.guild.id, 0);
        util.printMsg(msg, lang.warn.usersCleared);
      } else {
        //Purge the user
        var user = util.getUserFromArg(msg, args[0]);
        await db.user.updateWarnings(msg.guild.id, user.id, 0);
        util.printMsg(msg, lang.warn.userCleared);
      }
    }
  },
  warn: async function(msg, user, num) {
    var warnings = await db.user.getWarnings(msg.guild.id, user.id);
    if (warnings == undefined) {
      //Default
      warnings = 0;
    }
    //User warnings found!
    warnings += num;
    //Make sure the values doesn't get under 0
    if (warnings < 0) {
      warnings = 0;
    }
    await db.user.updateWarnings(msg.guild.id, user.id, warnings);
    util.printMsg(msg, mustache.render(lang.warn.list, {
      userId: user.id,
      warning: warnings
    }));
  }
}
