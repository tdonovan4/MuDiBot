const bot = require('../../bot.js');
const config = require('../../args.js').getConfig()[1];
const mustache = require('mustache');
const db = require('../database/database.js');
const player = require('../music/audio-player.js');
var lang = require('../../localization.js').getLocalization();

function printSingleCmd(msg, cmd) {
  const Discord = require("discord.js");

  var embed = new Discord.RichEmbed();
  embed.title = cmd.name;
  embed.color = 0x3aa00a;
  embed.addField(lang.custcmdlist.action, cmd.action, true)
  embed.addField(lang.custcmdlist.creator, msg.guild.members.get(cmd.user_id).user.username, true)
  embed.addField(lang.custcmdlist.arg, cmd.arg, false);
  msg.channel.send({
    embed
  });
}

async function printAllCmds(msg, args) {
  var cmds = await db.customCmd.getCmds(msg.guild.id);
  if (cmds.length > 0) {
    var names;
    if (args.length == 0) {
      //All commands
      names = cmds.map(x => x.name);
    } else {
      //User's commands
      names = cmds.filter(x => x.author_id == msg.mentions.users.first().id).map(x => x.name);
    }
    if (names != undefined) {
      var output = '';
      var spaces = 25;

      for (var i = 0; i < names.length; i++) {
        output += names[i] + Array(spaces - names[i].length).join(" ");
        if ((i + 1) % 5 == 0) {
          output += '\n';
        }
      }
      msg.channel.send(output, {
        code: 'css'
      });
      //Little message
      msg.channel.send(mustache.render(lang.custcmdlist.msg, {
        config
      }))
    }
  } else {
    bot.printMsg(msg, lang.custcmdlist.empty);
  }
}

module.exports = {
  CustCmdCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'custcmd',
        aliases: ['cc'],
        category: 'fun',
        priority: 2,
        permLvl: 1
      });
    }
    async execute(msg, args) {
      var cmds = await db.customCmd.getCmds(msg.guild.id);
      if (cmds == undefined) {
        cmds = [];
      }
      //Check if user have too many commands (ignore if admin or superuser)
      if (msg.member.permissions.has('ADMINISTRATOR') ||
        config.superusers.find(x => x == msg.author.id) != undefined ||
        cmds.filter(x => x.author_id == msg.author.id).length < config.custcmd.maxCmdsPerUser) {
        //Check if cmd already exists
        if (cmds.find(x => x.name == args[0]) != undefined) {
          bot.printMsg(msg, lang.error.cmdAlreadyExists);
        } else {
          //Max number of custom commands is 100
          if (cmds.length <= 100) {
            //Check if there is enough args and if length of name < 25 characters
            if (args.length >= 3 && args[0].length < 25) {
              //Add command to db
              if (args[1] == 'say' || args[1] == 'play') {
                await db.customCmd.insertCmd(
                  msg.guild.id,
                  msg.author.id,
                  args[0],
                  args[1],
                  args.slice(2).join(' '));
                bot.printMsg(msg, lang.custcmd.cmdAdded);
                return;
              }
            }
            //Wrong usage
            bot.printMsg(msg, lang.error.usage);
          } else {
            //Too much commands
            bot.printMsg(msg, lang.error.tooMuch.cmds);
          }
        }
      } else {
        //User have too much commands
        bot.printMsg(msg, lang.error.tooMuch.cmdsUser);
      }
    }
  },
  CustCmdListCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'custcmdlist',
        aliases: ['cclist'],
        category: 'fun',
        priority: 1,
        permLvl: 1
      });
    }
    async execute(msg, args) {
      var cmd = await db.customCmd.getCmd(msg.guild.id, args[0]);
      if (cmd != undefined) {
        //Print info about the command
        printSingleCmd(msg, cmd);
      } else {
        await printAllCmds(msg, args);
      }
    }
  },
  CustCmdRemoveCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'custcmdremove',
        aliases: ['ccrem'],
        category: 'fun',
        priority: 0,
        //TODO: Reduce to 1, execute only if creator or permLvl >= 3
        permLvl: 3
      });
    }
    async execute(msg, args) {
      var name = args[0]
      var cmd = await db.customCmd.getCmd(msg.guild.id, name);
      if (cmd != undefined) {
        //Command exist, deleting
        await db.customCmd.deleteCmd(msg.guild.id, name);
        bot.printMsg(msg, lang.custcmdremove.cmdRemoved);
      } else {
        //Command not found
        bot.printMsg(msg, lang.error.notFound.cmd);
      }
    }
  },
  executeCmd: function(msg, custCmd) {
    switch (custCmd.action) {
      case 'say':
        msg.channel.send(custCmd.arg);
        break;
      case 'play':
        player.playYoutube(msg, custCmd.arg);
        break;
      default:
        console.log(lang.error.invalidArg.cmd);
    }
  }
}
