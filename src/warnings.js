//Handle warnings
const storage = require('./storage.js');
const bot = require('./bot.js');
const mustache = require('mustache');
const sql = require('sqlite');
var lang = require('./localization.js').getLocalization();

function modifyUsersWarnings(msg, value) {
  sql.open('./storage/data.db').then(() => {
    sql.run('CREATE TABLE IF NOT EXISTS users (serverId TEXT, userId TEXT, xp INTEGER, warnings INTEGER)')
      .then(() => {
        sql.run('UPDATE users SET warnings = ? WHERE serverId = ?', [value, msg.guild.id]).catch(error => {
          console.log(error);
        });
      }).catch(error => {
        console.log(error);
      });
    sql.close();
  }).catch(error => {
    console.log(error);
  });
}

function modifyUserWarnings(msg, userId, value) {
  sql.open('./storage/data.db').then(() => {
    sql.run('CREATE TABLE IF NOT EXISTS users (serverId TEXT, userId TEXT, xp INTEGER, warnings INTEGER)')
      .then(() => {
        sql.run('UPDATE users SET warnings = ? WHERE serverId = ? AND userId = ?', [value, msg.guild.id, userId])
          .catch(error => {
            console.log(error);
          });
      }).catch(error => {
        console.log(error);
      });
    sql.close();
  }).catch(error => {
    console.log(error);
  });
}

module.exports = {
  warn: async function(msg, num) {
    if (msg.mentions.users.first() != undefined) {
      //There is a mention
      var user = await storage.getUser(msg, msg.mentions.users.first().id);
      var warnings = user.warnings

      if (warnings != undefined) {
        //User warnings found!
        warnings = warnings + num;
        modifyUserWarnings(msg, user.userId, warnings);
        user.warnings = warnings;
        bot.printMsg(msg, mustache.render(lang.warn.list, user));
      } else {
        bot.printMsg(msg, lang.error.invalidArg.user);
      }
    } else {
      bot.printMsg(msg, lang.error.usage);
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
      modifyUsersWarnings(msg, 0)
      bot.printMsg(msg, lang.warn.usersCleared);
    } else if (msg.mentions.users.first() != undefined) {
      //Purge the user
      var user = await storage.getUser(msg, msg.mentions.users.first().id);

      if (user != undefined) {
        modifyUserWarnings(msg, user.userId, 0)
        bot.printMsg(msg, lang.warn.userCleared);
      } else {
        bot.printMsg(msg, lang.error.invalidArg.user);
      }
    } else {
      bot.printMsg(msg, lang.error.usage);
    }
  }
}
