exist = function(obj, key) {
  return key.split(".").every(function(x) {
    if (typeof obj != "object" || obj === null || !x in obj)
      return false;
    obj = obj[x];
    return true;
  });
}

//Handle warnings
const storage = require('./storage.js');
const bot = require('./bot.js');
const mustache = require('mustache');
var lang = require('./localization.js').getLocalization();

module.exports = {
  warningList: null,
  warn: async function(msg) {
    let args = msg.content.split(" ").slice(1);
    let users = msg.mentions.users.array();

    //Check if there is arguments
    if (args.length > 0) {

      var warnCmd = {
        clear: {
          all: function() {
            storage.modifyUsers(msg, 'warnings', 0)
            bot.printMsg(msg, lang.warn.usersCleared);
          },
          user: function() {
            var userId = msg.mentions.users.first().id;
            storage.modifyUser(msg, userId, 'warnings', 0)
            bot.printMsg(msg, lang.warn.userCleared);
          }
        },
        list: {
          undefined: async function() {
            var users = await storage.getUsers(msg);

            if (users == undefined) {
              bot.printMsg(msg, lang.warn.noWarns);
            } else {
              var output = '';
              for (i = 0; i < users.length; i++) {
                if (users[i].warnings > 0) {
                  if (output !== '') {
                    output += '\n';
                  }
                  output += mustache.render(lang.warn.list, users[i]);
                }
              }
              if (output === '') {
                output = lang.warn.noWarns;
              }
              bot.printMsg(msg, output);
            }
          },
          user: async function() {
            var user = await storage.getUser(msg, msg.mentions.users.first().id);
            if(user != undefined) {
              bot.printMsg(msg, mustache.render(lang.warn.list, user));
            } else {
              bot.printMsg(msg, lang.error.invalidArg.user);
            }
          }
        },
        remove: {
          user: async function() {
            var user = await storage.getUser(msg, msg.mentions.users.first().id);
            var warnings = user.warnings;

            if (warnings > 0 && warnings != undefined) {
              warnings--;
              storage.modifyUser(msg, user.userId, 'warnings', warnings);
              user.warnings = warnings;
            }
            bot.printMsg(msg, mustache.render(lang.warn.list, user));
          }
        },
        user: async function() {
          var user = await storage.getUser(msg, msg.mentions.users.first().id);
          var warnings = user.warnings
          if (warnings != undefined) {
            warnings++;
            storage.modifyUser(msg, user.userId, 'warnings', warnings);
            user.warnings = warnings;
            bot.printMsg(msg, mustache.render(lang.warn.list, user));
          }
        }
      }
      checkKeys();

      function checkKeys() {
        let i = args.length - 1
        let obj = (i < 1) ? warnCmd : warnCmd[args[0]];
        let keys = (i < 1) ? args[0] : args[0] + '.' + args[1];


        if (exist(warnCmd, keys) && typeof obj[args[i]] === "function") {
          //If arg is in warnCmd
          obj[args[i]]();
        } else if (typeof users[0] != 'undefined' && args[i].includes(users[0].id)) {
          //If arg is a user
          obj['user']();
        } else if (args[1] == undefined) {
          //If arg is undefined
          if (exist(warnCmd, args[i] + '.' + 'undefined')) {
            obj[args[i]]['undefined']();
          } else {
            bot.printMsg(msg, lang.error.usage);
          }
        } else {
          bot.printMsg(msg, lang.error.usage);
        }
      }
    } else {
      bot.printMsg(msg, lang.error.usage);
    }
  }
}
