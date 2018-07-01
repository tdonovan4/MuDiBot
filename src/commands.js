const bot = require('./bot.js');
const fs = require('fs');
const db = require('./modules/database/database.js');
var args = require('./args.js');
var config = args.getConfig()[1];
var lang = require('./localization.js').getLocalization();

module.exports = {
  commands: new Map(),
  categories: new Map(),
  registerCategories: function(categories) {
    for (category of categories) {
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
        //Check if really a file
        if (fs.statSync(`./src/modules/${module}/${file}`).isFile()) {
          var keys = require(`./modules/${module}/${file}`);
          //Check if object
          if (typeof keys != 'object') {
            keys = {
              keys
            }
          }
          for (var key in keys) {
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
    }
  },
  /*
   *Check if the message author has permission
   *to do the command, return true or false
   */
  checkPerm: async function(msg, permLevel) {
    //Exceptions
    //Check if user is superuser
    for (var i = 0; i < config.superusers.length; i++) {
      if (msg.author.id === config.superusers[i]) {
        return true;
      }
    }

    //Check if user is an administrator
    var permissions = msg.member.permissions;
    if (permissions.has('ADMINISTRATOR')) {
      return true;
    }

    var userGroup = await db.user.getPermGroups(msg.guild.id, msg.author.id);
    if (userGroup != null && userGroup != 'empty') {
      userGroup = userGroup.split(',').sort(function(a, b) {
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
  checkIfValidCmd: async function(msg, args) {
    var command = getCmd(args[0]);

    //Check if message begins with prefix, if cmd is a valid command
    if (msg.content.startsWith(config.prefix) && command != null) {
      console.log(msg.author.username + ' - ' + msg.content);

      //Check if user has permission
      var result = await this.checkPerm(msg, command.permLvl);
      if (result) {
        //Valid command that can be used by the user
        return true;
      }
    }
    //The command was not found or didn't execute
    return false;
  },
  executeCmd: async function(msg, args) {
    //Execute the commandd
    await getCmd(args[0]).execute(msg, msg.content.split(" ").slice(1));
  },
}

function getCmd(arg) {
  var command = module.exports.commands.get(arg);
  if (!command) {
    //Search if alias
    module.exports.commands.forEach(function(aCommand) {
      if (aCommand.aliases.includes(arg)) {
        command = aCommand;
        return;
      }
    });
  }
  //Check if activated
  var cmdActivated = config[arg] != undefined ? config[arg].activated : true;
  if (cmdActivated) {
    return command;
  }
}
