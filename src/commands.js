const fs = require('fs');
const db = require('./modules/database/database.js');
const util = require('./util.js');
var config = util.getConfig()[1];
var lang = require('./localization.js').getLocalization();

class Command {
  constructor(commandInfo) {
    //The name of the command
    this.name = commandInfo.name;
    //The aliases
    this.aliases = commandInfo.aliases;
    //The wanted arguments
    this.args = commandInfo.args;
    //The category for help
    this.category = commandInfo.category;
    //The priority for the position in help
    this.priority = commandInfo.priority;
    //The required permission level to use this command
    this.permLvl = commandInfo.permLvl;
  }
  checkArgs(msg, msgArgs) {
    var valid = true;
    if (this.args != undefined) {
      var msgArgPos = 0;
      for (var cmdArg of this.args) {
        //Check if missing
        if (msgArgs == undefined || msgArgs[msgArgPos] == undefined) {
          if (!cmdArg.optional) {
            //Throw error
            msg.channel.send(cmdArg.missingError);
            valid = false;
            break;
          }
        } else {
          //Check if valid
          if (!cmdArg.checkArg(msg, msgArgs[msgArgPos])) {
            if (!cmdArg.optional || cmdArg.failOnInvalid) {
              //Throw error
              msg.channel.send(cmdArg.invalidError);
              valid = false;
              break;
            }
          } else {
            //Increment for new message argument
            msgArgPos++;
          }
        }
      }
    }
    return valid;
  }
}

class Argument {
  constructor(argInfo) {
    //Is it optional?
    this.optional = argInfo.optional;
    //The type (int, channel, mention or nothing)
    this.type = argInfo.type;
    //An array of possible values for this arg (empty array to disable)
    this.possibleValues = argInfo.possibleValues;
    //If true, the argument will throw an error when invalid even if optional
    this.failOnInvalid = argInfo.failOnInvalid;
    //When the argument is missing
    this.missingError = argInfo.missingError;
    //When the argument is not valid
    this.invalidError = argInfo.invalidError;
  }
  checkArg(msg, msgArg) {
    var valid = true
    var group;
    //TODO: make an argument class
    //Check input
    switch (this.type) {
      case 'int':
        if (Number(msgArg)) {
          //Argument is not a number
          valid = false;
        }
        break;
      case 'channel':
        var channelID = msgArg.match(/<#(.*?)>/);
        if (channelID == null || !msg.guild.channels.has(channelID[1])) {
          //Argument is not a channel
          valid = false;
        }
        break;
      case 'mention':
        //Checking mention manually, because I care about it's position
        var mentionID = msgArg.match(/<@(.*?)>/);
        if (mentionID == null || !msg.guild.members.has(mentionID[1])) {
          //Argument is not a mention
          valid = false;
        }
        break;
      case 'group':
        group = msgArg.charAt(0).toUpperCase() + msgArg.slice(1);
        if (config.groups.find(x => x.name == group) == undefined) {
          //Argument is not a group
          valid = false;
        }
        break;
      case 'rank':
        //Put first character of rank in uppercase
        var rank = msgArg.charAt(0).toUpperCase() + msgArg.slice(1);
        //Change underscore to space
        rank = rank.replace('_', ' ');
        //To search for the ranks in the correct language
        if (Object.keys(lang.ranks).find(x => lang.ranks[x] === rank) == undefined) {
          //Argument is not a rank
          valid = false;
        }
        break;
      case 'reward':
        var groupName = msgArg.charAt(0).toUpperCase() + msgArg.slice(1);
        group = config.groups.find(x => x.name == groupName);
        var groupID = msgArg.match(/<@&(.*?)>/);
        if (groupID != undefined) {
          var role = msg.guild.roles.get(groupID[1]);
        }
        if (group == undefined && role == undefined) {
          //Argument is not a group or a role
          valid = false;
        }
        break;
    }
    //Check if the message argument is in possible values
    if (this.possibleValues != undefined &&
      this.possibleValues.indexOf(msgArg) == -1) {
      //Not in possible values
      valid = false;
    }
    return valid;
  }
}

class Category {
  constructor(categoryInfo) {
    this.name = categoryInfo.name;
    this.priority = categoryInfo.priority;
    this.commands = new Map();
  }
  addCommand(command) {
    this.commands.set(command.name, command);
  }
}

module.exports = {
  Command: Command,
  Argument: Argument,
  Category: Category,
  commands: new Map(),
  /*
   * We need an array with reference for help because else it won't
   * get the commands after for checking the argument
   */
  namesAndAliases: [],
  categories: new Map(),
  registerCategories: function(categories) {
    for (category of categories) {
      //Add the category
      var category = new Category(category);
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
            if (keys[key].prototype instanceof Command) {
              var command = new keys[key]();
              if (!this.categories.has(module)) {
                this.registerCategories([module]);
              }
              //Add command to the list of commands
              this.commands.set(command.name, command);
              //Add command name and alias(es)
              this.namesAndAliases.push(command.name, ...command.aliases);
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
    util.printMsg(msg, lang.error.notEnoughPermissions);
    return false;
  },
  getCmd: function(arg) {
    var command = this.commands.get(arg);
    if (!command) {
      //Search if alias
      this.commands.forEach(function(aCommand) {
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
  },
  checkIfValidCmd: async function(msg, args) {
    var command = this.getCmd(args[0]);

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
    //Check the arguments before executing
    var cmd = this.getCmd(args[0]);
    if (cmd.checkArgs(msg, args.slice(1))) {
      //Execute the commandd
      await cmd.execute(msg, args.slice(1));
    }
  }
}
