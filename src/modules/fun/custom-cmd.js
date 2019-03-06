const Discord = require("discord.js");
const mustache = require('mustache');
const { printMsg } = require('../../util.js');
const commands = require('../../commands.js');
const config = require('../../util.js').getConfig()[1];
const db = require('../database/database.js');
var lang = require('../../localization.js').getLocalization();

function printSingleCmd(msg, cmd) {
  if (cmd !== undefined) {
    var embed = new Discord.RichEmbed();
    embed.title = cmd.name;
    embed.color = 0x3aa00a;
    embed.addField(lang.listcustomcmd.creator, msg.guild.members.get(cmd.author_id).user.username, true)
    embed.addField(lang.listcustomcmd.arg, cmd.arg, false);
    msg.channel.send({
      embed
    });
  } else {
    printMsg(msg, lang.error.invalidArg.cmd);
  }
}

function printAllCmds(msg, cmds) {
  if (cmds.length > 0) {
    let names = cmds.map(x => x.name);
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
    }));
  } else {
    printMsg(msg, lang.listcustomcmd.empty);
  }
}

async function isCommandAuthor(msg, args) {
  let name = args[0];
  let cmd = await db.customCmd.getCmd(msg.guild.id, name);
  if (cmd === undefined) {
    return false;
  }
  return cmd.author_id === msg.author.id;
}

async function hasTooMuchCmds(msg, cmds) {
  //Exceptions
  if (msg.member.permissions.has('ADMINISTRATOR') ||
    config.superusers.find(x => x == msg.author.id) != undefined) {
    return false;
  }
  let numCustomCmds = cmds.filter(x => x.author_id == msg.author.id).length;
  let maxCustomCmd = (await db.user.getHighestPermGroup(msg.guild.id,
    msg.author.id)).maxCustomCmd;
  return numCustomCmds <= maxCustomCmd;
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
      //Get existing commands
      let cmds = await db.customCmd.getCmds(msg.guild.id);
      if (cmds === undefined) {
        cmds = [];
      }
      //Check if user have too many commands (ignore if admin or superuser)
      if (await hasTooMuchCmds(msg, cmds)) {
        //User have too much commands
        printMsg(msg, lang.error.tooMuch.cmdsUser);
      } else {
        //Check if cmd already exists
        if (cmds.find(x => x.name == args[0]) != undefined) {
          printMsg(msg, lang.error.cmdAlreadyExists);
        } else {
          //Check if length of name > 25 characters
          if (args[0].length > 25) {
            printMsg(msg, lang.createcmd.tooLong);
          } else {
            //Add command to db
            await db.customCmd.insertCmd(
              msg.guild.id,
              msg.author.id,
              args[0],
              args.slice(1).join(' '));
            printMsg(msg, lang.createcmd.cmdAdded);
          }
        }
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
        permLvl: 3,
        ignorePermLvl: isCommandAuthor
      });
    }
    async execute(msg, args) {
      let name = args[0]
      let cmd = await db.customCmd.getCmd(msg.guild.id, name);
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
      if (args.length > 0) {
        //Check if there is a mention
        let mention = args[0].match(/<@!?(.*?[0-9])>/);
        if (mention !== null && msg.guild.members.has(mention[1])) {
          //Print the commands this user authored
          let customCmds = await db.customCmd.getUserCmds(msg.guild.id, mention[1]);
          printAllCmds(msg, customCmds);
        } else {
          //Search if the argument is a command and if yes, print it
          var cmd = await db.customCmd.getCmd(msg.guild.id, args[0]);
          printSingleCmd(msg, cmd);
        }
      } else {
        //Just print all the command
        let customCmds = await db.customCmd.getCmds(msg.guild.id);
        printAllCmds(msg, customCmds);
      }
    }
  },
  executeCmd: function(msg, custCmd) {
    msg.channel.send(custCmd.arg);
  }
}
