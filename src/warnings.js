//Handle warnings
const storage = require('./storage.js');
const bot = require('./bot.js');
const mustache = require('mustache');
var lang = require('./localization.js').getLocalization();

module.exports = {
  warn: async function(msg, num) {
    var user = await storage.getUser(msg, msg.mentions.users.first().id);
    var warnings = user.warnings

    if (warnings != undefined) {
      //User warnings found!
      warnings = warnings + num;
      storage.modifyUser(msg, user.userId, 'warnings', warnings);
      user.warnings = warnings;
      bot.printMsg(msg, mustache.render(lang.warn.list, user));
    } else {
      bot.printMsg(msg, lang.error.invalidArg.user);
    }
  },
  list: async function(msg) {
    var args = msg.content.split(" ").slice(1);
    if (args == 'all') {
      //List all users warnings
      var users = await storage.getUsers(msg);

      var output = '';
      for (i = 0; i < users.length; i++) {
        if (users[i].warnings > 0) {
          if (i > 0) {
            output += '\n';
          }
          output += mustache.render(lang.warn.list, users[i]);
        }
      }
      if (output === '') {
        output = lang.warn.noWarns;
      }
      bot.printMsg(msg, output);
    } else if (msg.mentions.users.first() != undefined) {
      //List the user's warnings
      var user = await storage.getUser(msg, msg.mentions.users.first().id);

      if (user != undefined) {
        bot.printMsg(msg, mustache.render(lang.warn.list, user));
      } else {
        bot.printMsg(msg, lang.error.invalidArg.user);
      }
    } else {
      bot.printMsg(msg, lang.error.usage);
    }
  },
  purge: async function(msg) {
    var args = msg.content.split(" ").slice(1);

    if (args == 'all') {
      //Purge all users
      storage.modifyUsers(msg, 'warnings', 0)
      bot.printMsg(msg, lang.warn.usersCleared);
    } else if (msg.mentions.users.first() != undefined) {
      //Purge the user
      var user = await storage.getUser(msg, msg.mentions.users.first().id);

      if (user != undefined) {
        storage.modifyUser(msg, user.userId, 'warnings', 0)
        bot.printMsg(msg, lang.warn.userCleared);
      } else {
        bot.printMsg(msg, lang.error.invalidArg.user);
      }
    } else {
      bot.printMsg(msg, lang.error.usage);
    }
  }
}
