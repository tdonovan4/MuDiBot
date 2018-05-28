const bot = require('../../bot.js');
const sql = require('sqlite');
const config = require('../../args.js').getConfig()[1];
const mustache = require('mustache');
const player = require('../music/audio-player.js');
var lang = require('../../localization.js').getLocalization();

async function insertCmd(msg, args) {
  try {
    await sql.open(config.pathDatabase);
    await sql.run('INSERT INTO customCmds (serverId, userId, name, action, arg) VALUES (?, ?, ?, ?, ?)', [
      msg.guild.id, msg.author.id, args[0], args[1], args.slice(2).join(' ')
    ]);
    await sql.close();
  } catch (e) {
    console.error(e);
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
      var cmds = await module.exports.getCmds(msg);
      if (cmds == undefined) {
        cmds = [];
      }
      //Check if user have too many commands (ignore if admin or superuser)
      if (msg.member.permissions.has('ADMINISTRATOR') ||
        config.superusers.find(x => x == msg.author.id) != undefined ||
        cmds.filter(x => x.userId == msg.author.id).length < config.custcmd.maxCmdsPerUser) {
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
                await insertCmd(msg, args);
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
    execute(msg, args) {
      module.exports.printCmds(msg, args);
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
      try {
        await sql.open(config.pathDatabase);
      } catch (e) {
        console.error(e);
      }
      try {
        var row = await sql.all("SELECT * FROM customCmds WHERE serverId = ? AND name = ?", [msg.guild.id, args[0]]);
      } catch (e) {
        try {
          await sql.run('CREATE TABLE IF NOT EXISTS customCmds (serverId TEXT, userId TEXT, name TEXT, action TEXT, arg TEXT)');
        } catch (e) {
          console.error(e);
        }
      }
      if (row.length > 0) {
        try {
          await sql.all("DELETE FROM customCmds WHERE serverId = ? AND name = ?", [msg.guild.id, args[0]])
        } catch (e) {
          console.error(e);
        }
        bot.printMsg(msg, lang.custcmdremove.cmdRemoved);
      } else {
        //Command not found
        bot.printMsg(msg, lang.error.notFound.cmd);
      }
      await sql.close();
    }
  },
  getCmds: async function(msg) {
    try {
      await sql.open(config.pathDatabase);
    } catch (e) {
      console.error(e);
    }
    try {
      var row = await sql.all('SELECT * FROM customCmds WHERE serverId = ?', msg.guild.id);
    } catch (e) {
      try {
        await sql.run('CREATE TABLE IF NOT EXISTS customCmds (serverId TEXT, userId TEXT, name TEXT, action TEXT, arg TEXT)');
      } catch (e) {
        console.error(e);
      }
    }
    await sql.close();
    return row;
  },
  printCmds: async function(msg, args) {
    var cmds = await this.getCmds(msg);
    if (cmds.length > 0) {
      var cmd = cmds.find(x => x.name == args[0]);
      if (cmd != undefined) {
        //Print info about the command
        const Discord = require("discord.js");

        var embed = new Discord.RichEmbed();
        embed.title = cmd.name;
        embed.color = 0x3aa00a;
        embed.addField(name = lang.custcmdlist.action, value = cmd.action, inline = true)
        embed.addField(name = lang.custcmdlist.creator, value = msg.guild.members.get(cmd.userId).user.username, inline = true)
        embed.addField(name = lang.custcmdlist.arg, value = cmd.arg, inline = false);
        msg.channel.send({
          embed
        });
      } else {
        if (args.length == 0) {
          //All commands
          var names = cmds.map(x => x.name);
        } else {
          //User's commands
          var names = cmds.filter(x => x.userId == msg.mentions.users.first().id).map(x => x.name);
        }
        if (names != undefined) {
          var output = '';
          var spaces = 25;

          for (i = 0; i < names.length; i++) {
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
      }
    } else {
      bot.printMsg(msg, lang.custcmdlist.empty);
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
