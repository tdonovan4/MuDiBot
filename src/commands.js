const Discord = require("discord.js");
const bot = require('./bot.js');
const warnings = require('./warnings.js');
const player = require('./audio-player.js');
const levels = require('./levels.js');
const defaultChannel = require('./default-channel.js');
const permGroup = require('./permission-group.js');
const fs = require('fs');
const mustache = require('mustache');
const storage = require('./storage.js');
var client = bot.client();
var args = require('./args.js');
var config = args.getConfig()[1];
var lang = require('./localization.js').getLocalization();

module.exports = {
  commands: new Map(),
  categories: new Map(),
  registerCategories: function(categories) {
    for(category of categories) {
      //Add the category
      var category = new bot.Category(category);
      this.categories.set(category.name, category);
    }
  },
  registerCommands: function() {
    //Search the modules for commands
    var modules = fs.readdirSync('./src/modules');
    for (var module of modules) {
      var files = fs.readdirSync(`./src/modules/${module}`);
      for (var file of files) {
        var keys = require(`./modules/${module}/${file}`);
        //Check if object
        if(typeof keys != 'object') {
          keys = {keys}
        }
        for (key in keys) {
          //Check if the key is a subclass of Command
          if (keys[key].prototype instanceof bot.Command) {
            var command = new keys[key]();
            if (!this.categories.has(module)) {
              this.registerCategories([module]);
            }
            //Add command to the list of commands
            this.commands.set(command.name, command);
            //Add command to the category
            this.categories.get(module).addCommand(command);
          }
        }
      }
    }
  },
  /*
   *Check if the message author has permission
   *to do the command, return true or false
   */
  checkPerm: async function (msg, permLevel) {
    //Exceptions
    //Check if user is superuser
    for (i = 0; i < config.superusers.length; i++) {
      if (msg.author.id === config.superusers[i]) {
        return true;
      }
    }

    //Check if user is an administrator
    var permissions = msg.member.permissions;
    if (permissions.has('ADMINISTRATOR')) {
      return true;
    }

    let user = await storage.getUser(msg, msg.author.id);

    var userGroup = user.groups
    if(userGroup != null) {
      userGroup.split(',').sort(function(a, b) {
        return config.groups.find(x => x.name == a).permLvl <
          config.groups.find(x => x.name == b).permLvl;
      })[0];
    } else {
      //Default if no group
      userGroup = config.groups[0].name;
    }
    var userPermLevel = config.groups.find(x => x.name == userGroup).permLvl;

    //Compare user and needed permission level
    if (userPermLevel >= permLevel) {
      return true;
    }
    bot.printMsg(msg, lang.error.notEnoughPermissions);
    return false;
  },
  checkIfValidCmd: async function(msg, cmd) {
    var cmdActivated = config[cmd[0]] != undefined ? config[cmd[0]].activated : true;
    var commands =module.exports.commands.get(cmd[0]);

    //Check if message begins with prefix, if cmd is a valid command and is it's activated
    if (msg.content.startsWith(config.prefix) && commands != null && cmdActivated) {
      console.log(msg.author.username + ' - ' + msg.content);

      //Check if user has permission
      result = await this.checkPerm(msg, commands.permLvl)
      if(result) {
        //Valid command that can be used by the user
        return true
      };
    }
    //The command was not found or didn't execute
    return false
  },
  executeCmd: async function(msg, cmd) {
    //Execute the commandd
    module.exports.commands.get(cmd[0]).execute(msg, msg.content.split(" ").slice(1));
  },
}
