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

//TODO: delete
//Format time
function time() {
  var time = process.uptime();
  var days = ~~(time / 86400)
  var hrs = ~~((time % 86400) / 3600);
  var mins = ~~((time % 3600) / 60);
  var secs = ~~(time % 60);
  return days + 'd:' + hrs + 'h:' + mins + 'm:' + secs + 's'
}

/*
 *Use an object containing command objects to get
 *the permission needed and execute the command
 */
var commands = {
  help: {
    //Display a list of commands and their usage
    permLvl: 0,
    category: "General",
    execute: function(msg) {
      const help = require('./help.js');
      let args = msg.content.split(" ").slice(1);

      if (args[0] != undefined) {
        //Check if args is a valid command
        if (args[0] in commands) {
          //Valid command
          help.printCmd(msg, commands);
        } else {
          bot.printMsg(msg, lang.error.invalidArg.cmd);
        }
      } else {
        //Print all commands
        help.printCmds(msg, Object.entries(commands));
      }
    }
  },

  ping: {
    //Reply "Pong!"
    permLvl: 0,
    category: "General",
    execute: function(msg) {
      msg.reply(lang.ping.pong);
      console.log(lang.ping.pong);
    }
  },

  info: {
    //Display info about the client
    permLvl: 0,
    category: "General",
    execute: function(msg) {
      var pjson = require('../package.json');
      var info = lang.info;

      var embed = new Discord.RichEmbed();
      embed.title = `__**${info.title}**__`;
      embed.color = 0x0080c0;
      embed.addField(name = `**${info.general.title}**`, value = `
        **${info.general.name}:** ${pjson.name}
        **${info.general.desc}:** ${pjson.description}
        **${info.general.author}:** ${pjson.author}
        **${info.general.version}:** ${pjson.version}
        **${info.general.uptime}:** ${time()}`.replace(/^( *)/gm, ''), inline = false)
      embed.addField(name = `**${info.config.title}**`, value = `
        **${info.config.language}:** ${config.locale}`.replace(/^( *)/gm, ''), inline = false)
      embed.setFooter(text = `${info.footer.clientId}: ${client.user.id}`)
      msg.channel.send({
        embed
      });
    }
  },

  status: {
    permLvl: 3,
    category: "General",
    execute: function(msg) {
      var newStatus = msg.content.split(`${config.prefix}status `).slice(1);
      client.user.setGame(newStatus[0]);
      var file = args.getConfig()[0].slice(1);

      module.exports.modifyText(file, 'currentStatus: \'' + config.currentStatus, 'currentStatus: \'' + newStatus[0]);
      config.currentStatus = newStatus[0];
    }
  },

  say: {
    permLvl: 3,
    category: "General",
    execute: function(msg) {
      let messageToSay = msg.content.split(' ').slice(1);
      let channel;

      //Try to find which channel to send message
      if (messageToSay[0] == 'here') {
        channel = msg.channel;
      } else {
        let id = messageToSay[0].match(/<#(.*?)>/);
        if (id != null) {
          channel = client.channels.get(id[1]);
        }
      }

      messageToSay = messageToSay.slice(1).join(' ');

      //Check arguments
      if (channel == undefined) {
        channel = msg.channel;
        messageToSay = lang.error.missingArg.channel;
      }

      if (messageToSay == undefined || messageToSay == '') {
        messageToSay = lang.error.missingArg.message;
      }

      //Send message
      channel.send(messageToSay);
    }
  },

  avatar: {
    permLvl: 0,
    category: "User",
    execute: function(msg) {
      var user = msg.mentions.users.first()
      if (user != undefined && user != null) {
        bot.printMsg(msg, user.avatarURL);
      } else {
        bot.printMsg(msg, lang.error.invalidArg.user);
      }
    }
  },

  profile: {
    permLvl: 0,
    category: "User",
    execute: async function(msg) {
      let user = msg.mentions.users.first();
      if (user == undefined) {
        //There is no mentions
        user = msg.author;
      }

      let userData = await storage.getUser(msg, user.id);
      let progression = levels.getProgression(userData.xp);
      let level = progression[0];
      let xpToNextLevel = `${progression[1]}/${levels.getXpForLevel(level)}`;
      let rank = levels.getRank(progression[2]);
      let groups = ['Ø'];

      //Get groups
      if(userData.groups != null) {
        groups = userData.groups.split(',').sort(function(a, b) {
          return config.groups.find(x => x.name == a).permLvl <
            config.groups.find(x => x.name == b).permLvl;
        });
      }

      //If user is a superuser, add that to groups
      if(config.superusers.find(x => x == user.id) != null) {
        groups.unshift('Superuser');
      }

      //Put newline at every 4 groups
      for(let i = 3; i < groups.length; i += 3) {
        groups[i] = '\n' + groups[i];
      }

      var embed = new Discord.RichEmbed();
      embed.title = mustache.render(lang.profile.title, user);
      embed.color = rank[2];
      embed.setThumbnail(url = user.avatarURL)
      embed.addField(name = lang.profile.rank,
        value = `${rank[0]} ${(rank[1] > 0) ? `(${rank[1]}:star:)` : ''}`,
        inline = true)
      embed.addField(name = lang.profile.groups, value = groups.join(', '), inline = true)
      embed.addField(name = lang.profile.level, value = `${level} (${xpToNextLevel})`, inline = false)
      embed.addField(name = lang.profile.xp, value = userData.xp, inline = true)
      embed.addField(name = lang.profile.warnings, value = userData.warnings, inline = true)
      embed.setFooter(text = mustache.render(lang.profile.footer, user))
      msg.channel.send({
        embed
      });
    }
  },

  setgroup: {
    permLvl: 3,
    category: "User",
    execute: async function(msg) {
      var args = msg.content.split(" ").slice(1);
      await permGroup.setGroup(msg, msg.mentions.users.first(), args[1]);
    }
  },

  unsetgroup: {
    permLvl: 3,
    category: "User",
    execute: async function(msg) {
      var args = msg.content.split(" ").slice(1);
      await permGroup.unsetGroup(msg, msg.mentions.users.first(), args[1]);
    }
  },
  get ungroup () {
    var cmd = Object.assign({}, this.unsetgroup);
    cmd.aliasOf = 'unsetgroup';
    return cmd;
  },

  purgegroups: {
    permLvl: 3,
    category: "User",
    execute: async function(msg) {
      await permGroup.purgeGroups(msg);
    }
  },
  get gpurge () {
    var cmd = Object.assign({}, this.purgegroups);
    cmd.aliasOf = 'purgegroups';
    return cmd;
  },

  gif: {
    permLvl: 1,
    category: "Fun",
    execute: async function(msg) {
      const giphy = require('./giphy-api.js');
      let args = msg.content.split(" ").slice(1);

      var url = await giphy.search(args);
      if (url != undefined) {
        msg.channel.send(url);
      }
    }
  },

  gifrandom: {
    permLvl: 1,
    category: "Fun",
    execute: async function(msg) {
      const giphy = require('./giphy-api.js');
      let args = msg.content.split(" ").slice(1);

      var url = await giphy.random(args);
      if (url != undefined) {
        msg.channel.send(url);
      }
    }
  },
  get gifr () {
    var cmd = Object.assign({}, this.gifrandom);
    cmd.aliasOf = 'gifrandom';
    return cmd;
  },

  flipcoin: {
    permLvl: 0,
    category: "Fun",
    execute: function(msg) {
      msg.reply(Math.floor(Math.random() * 2) == 0 ? lang.flipcoin.heads : lang.flipcoin.tails);
    }
  },

  roll: {
    permLvl: 0,
    category: "Fun",
    execute: function(msg) {
      args = msg.content.split(/[ d+]|(?=-)/g).slice(1);
      num = isNaN(args[2]) ? 0 : parseInt(args[2]);
      for (i = 0; i < args[0]; i++) {
        num += Math.floor(Math.random() * args[1]) + 1;
      }
      msg.reply(num);
    }
  },

  custcmd: {
    permLvl: 1,
    category: "Fun",
    execute: function(msg) {
      const customCmd = require('./custom-cmd.js');
      var args = msg.content.split(" ").slice(1);
      customCmd.addCmd(msg, args);
    }
  },
  get cc () {
    var cmd = Object.assign({}, this.custcmd);
    cmd.aliasOf = 'custcmd';
    return cmd;
  },

  custcmdlist: {
    permLvl: 1,
    category: "Fun",
    execute: function(msg) {
      const customCmd = require('./custom-cmd.js');
      var args = msg.content.split(" ").slice(1);
      customCmd.printCmds(msg, args);
    }
  },
  get cclist () {
    var cmd = Object.assign({}, this.custcmdlist);
    cmd.aliasOf = 'custcmdlist';
    return cmd;
  },

  custcmdremove: {
    permLvl: 3,
    category: "Fun",
    execute: function(msg) {
      const customCmd = require('./custom-cmd.js');
      var args = msg.content.split(" ").slice(1);
      customCmd.removeCmd(msg, args);
    }
  },
  get ccrem () {
    var cmd = Object.assign({}, this.custcmdremove);
    cmd.aliasOf = 'custcmdremove';
    return cmd;
  },

  play: {
    //Play a song on YouTube
    permLvl: 0,
    category: "Music",
    execute: function(msg) {
      player.playYoutube(msg, msg.content.split(" ").slice(1));
    }
  },

  stop: {
    //Stop the voice connection and leave voice channel
    permLvl: 0,
    category: "Music",
    execute: function(msg) {
      player.stop(msg);
    }
  },

  skip: {
    //Skip to next song in queue
    permLvl: "roleMember",
    category: "Music",
    execute: function(msg) {
      player.skip(msg);
    }
  },

  queue: {
    //Skip to next song in queue
    permLvl: 0,
    category: "Music",
    execute: function(msg) {
      player.listQueue(msg);
    }
  },

  warn: {
    permLvl: 2,
    category: "Warnings",
    execute: function(msg) {
      warnings.warn(msg, 1);
    }
  },

  unwarn: {
    permLvl: 2,
    category: "Warnings",
    execute: function(msg) {
      warnings.warn(msg, -1);
    }
  },

  warnlist: {
    permLvl: 2,
    category: "Warnings",
    execute: function(msg) {
      warnings.list(msg);
    }
  },

  warnpurge: {
    //Handle warnings
    permLvl: 2,
    category: "Warnings",
    execute: function(msg) {
      warnings.purge(msg);
    }
  },

  clearlog: {
    //Clear listed commands
    permLvl: 3,
    category: "Administration",
    execute: function(msg) {
      //Split the message to get only the argument
      let args = msg.content.split(" ").slice(1);
      let numToDel = args[0];

      //In case the argument isn't a valid number
      if (numToDel == null || isNaN(numToDel)) {
        numToDel = '50';
      }
      clear(msg, numToDel);
    }
  },

  kill: {
    //Kill the process
    permLvl: 3,
    category: "Administration",
    execute: function(msg) {
      console.log(lang.general.stopping);
      process.exitCode = 0;
      process.exit();
    }
  },

  restart: {
    //Restart the client
    permLvl: 3,
    category: "Administration",
    execute: function() {
      //Spawn new process
      var spawn = require('child_process').spawn;

      var child = spawn('node', ['./src/bot.js'], {
        detached: true,
        shell: true,
        stdio: 'ignore'
      });
      child.unref();

      console.log(lang.general.restarting);

      //Exit this process
      process.exitCode = 0;
      process.exit();
    }
  },

  setchannel: {
    permLvl: 3,
    category: "Administration",
    execute: function(msg) {
      var botChannel = msg.channel;
      //Modify default channel in database
      defaultChannel.setChannel(msg, botChannel);
      botChannel.send(lang.setchannel.newDefaultChannel);
    }
  },

  setreward: {
    permLvl: 3,
    category: "Administration",
    execute: function(msg) {
      levels.setReward(msg, msg.content.split(" ").slice(1));
    }
  },

  unsetreward: {
    permLvl: 3,
    category: "Administration",
    execute: function(msg) {
      levels.unsetReward(msg, msg.content.split(" ").slice(1));
    }
  }
}

var keys = Object.keys(commands);

//Function that fetch, check and delete messages
function clear(msg, num) {
  //Add command and users to clear to list
  var clearList = config.clearlog.commandsToClear.concat(config.clearlog.usersToClear);
  //Add bot commands to list
  clearList = clearList.concat(keys.map(x => config.prefix + x));
  //Remove empty string from list
  clearList = clearList.filter(x => x != '');

  //Fetch
  msg.channel.fetchMessages({
      limit: parseInt(num)
    })
    .then(messages => {
      console.log(lang.clearlog.maxNum + num);
      var msg = messages.array();
      var deletedMessages = 0;

      //Check messages
      for (var i = 0; i < messages.array().length; i++) {
        //Delete commands from bot
        if (msg[i].author.id === client.user.id) {
          msg[i].delete()
          deletedMessages++;
        } else {
          //Find and delete
          for (var n = 0; n < clearList.length; n++) {
            if (msg[i].content.substring(0, clearList[n].length) === clearList[n] || msg[i].author.id === clearList[n]) {
              msg[i].delete()
              deletedMessages++;
              break
            }
          }
        }
      }
      console.log(mustache.render(lang.clearlog.deleted, {
        deletedMessages
      }));
    })
    .catch(console.error);
}

module.exports = {
  commands: new Map(),
  categories: new Map(),
  registerCommands: function(msg) {
    //Search the modules for commands
    var modules = fs.readdirSync('./src/modules');
    for(var module of modules) {
      var files = fs.readdirSync(`./src/modules/${module}`);
      for(var file of files) {
        var commands = require(`./modules/${module}/${file}`);
        var command = new commands();
        console.log(command);

        if(!this.categories.has(module)) {
          //Add a category
          var category = new bot.Category(module);
          this.categories.set(category.name, category);
        }
        //Add command to the list of commands
        this.commands.set(command.name, command);
        //Add command to the category
        this.categories.get(module).addCommand(command);
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

    //Check if message begins with prefix, if cmd is a valid command and is it's activated
    if (msg.content.startsWith(config.prefix) && cmd[0] in commands && cmdActivated) {
      console.log(msg.author.username + ' - ' + msg.content);

      //Check if user has permission
      result = await this.checkPerm(msg, commands[cmd[0]].permLvl)
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
    //await commands[cmd[0]].execute(msg)
    module.exports.commands.get(cmd[0]).execute(msg, msg.content.split(" ").slice(1));
  },

  //TODO: remove
  modifyText: function(file, text, value) {
    fs.readFile(file, 'utf8', function(err, data) {
      if (err) {
        return console.log(err);
      }
      var result = data.replace(text, value);

      fs.writeFile(file, result, 'utf8', function(err) {
        if (err) return console.log(err);
      });
    });
  }
}
