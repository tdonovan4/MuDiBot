const mustache = require('mustache');
const { printMsg } = require('../../util.js');
const commands = require('../../commands.js');
const config = require('../../util.js').getConfig()[1];
const db = require('../database/database.js');
const player = require('../music/audio-player.js');
var lang = require('../../localization.js').getLocalization();

function printSingleCmd(msg, cmd) {
  const Discord = require("discord.js");

  var embed = new Discord.RichEmbed();
  embed.title = cmd.name;
  embed.color = 0x3aa00a;
  embed.addField(lang.listcustomcmd.action, cmd.action, true)
  embed.addField(lang.listcustomcmd.creator, msg.guild.members.get(cmd.author_id).user.username, true)
  embed.addField(lang.listcustomcmd.arg, cmd.arg, false);
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
    if (names[0] != undefined) {
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
      msg.channel.send(mustache.render(lang.listcustomcmd.msg, {
        config
      }))
    } else {
      printMsg(msg, lang.listcustomcmd.empty);
    }
  } else {
    printMsg(msg, lang.listcustomcmd.empty);
  }
}

module.exports = {
  CreateCmdCommand: class extends commands.Command {
    constructor() {
      super({
        name: 'createcmd',
        aliases: ['createcommand', 'createcustomcmd', 'createcustomcommand'],
        args: [
          new commands.Argument({
            optional: false,
            interactiveMsg: lang.createcmd.interactiveMode.name,
            missingError: lang.error.missingArg.name,
          }),
          new commands.Argument({
            optional: false,
            interactiveMsg: lang.createcmd.interactiveMode.action,
            possibleValues: ['say', 'play'],
            missingError: lang.error.missingArg.action,
            invalidError: lang.error.invalidArg.action
          }),
          new commands.Argument({
            optional: false,
            interactiveMsg: lang.createcmd.interactiveMode.arg,
            missingError: lang.error.missingArg.message,
          })
        ],
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
        cmds.filter(x => x.author_id == msg.author.id).length < config.createcmd.maxCmdsPerUser) {
        //Check if cmd already exists
        if (cmds.find(x => x.name == args[0]) != undefined) {
          printMsg(msg, lang.error.cmdAlreadyExists);
        } else {
          //length of name < 25 characters
          if (args[0].length < 25) {
            //Add command to db
            await db.customCmd.insertCmd(
              msg.guild.id,
              msg.author.id,
              args[0],
              args[1],
              args.slice(2).join(' '));
            printMsg(msg, lang.createcmd.cmdAdded);
          } else {
            printMsg(msg, lang.createcmd.tooLong);
          }
        }
      } else {
        //User have too much commands
        printMsg(msg, lang.error.tooMuch.cmdsUser);
      }
    }
  },
  DeleteCmdCommand: class extends commands.Command {
    constructor() {
      super({
        name: 'deletecmd',
        aliases: ['delcmd', 'deletecustomcmd', 'deletecommand', 'deletecustomcommand'],
        args: [
          new commands.Argument({
            optional: false,
            interactiveMsg: lang.deletecmd.interactiveMode.command,
            missingError: lang.error.missingArg.cmd,
          })
        ],
        category: 'fun',
        priority: 1,
        //TODO: Reduce to 1, execute only if creator or permLvl >= 3
        permLvl: 3
      });
    }
    async execute(msg, args) {
      var name = args[0]
      var cmd = await db.customCmd.getCmd(msg.guild.id, name);
      //Can't use args because it needs the database :/
      if (cmd != undefined) {
        //Command exist, deleting
        await db.customCmd.deleteCmd(msg.guild.id, name);
        printMsg(msg, lang.deletecmd.cmdRemoved);
      } else {
        //Command not found
        printMsg(msg, lang.error.notFound.cmd);
      }
    }
  },
  ListCustomCmdCommand: class extends commands.Command {
    constructor() {
      super({
        name: 'listcustomcmd',
        aliases: ['listcmd', 'listcommand', 'listcustomcommand'],
        category: 'fun',
        priority: 0,
        permLvl: 1
      });
    }
    async execute(msg, args) {
      var cmd = await db.customCmd.getCmd(msg.guild.id, args[0]);
      if (cmd != undefined) {
        //Print info about the command
        printSingleCmd(msg, cmd);
      } else {
        //Print all commands
        await printAllCmds(msg, args);
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
        printMsg(msg, lang.error.invalidArg.cmd);
    }
  }
}
