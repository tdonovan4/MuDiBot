const config = require('../../util.js').getConfig()[1];
const { printMsg } = require('../../util.js')
const { Command } = require('../../commands.js')
const mustache = require('mustache');
const commands = require('../../commands.js');
var lang = require('../../localization.js').getLocalization();

module.exports = class helpCommand extends Command {
  constructor() {
    super({
      name: 'help',
      aliases: [],
      category: 'general',
      priority: 10,
      permLvl: 0
    });
  }
  execute(msg, args) {
    if (args[0] != undefined) {
      //Check if args is a valid command
      if (commands.commands.has(args[0])) {
        //Valid command
        printCmd(msg, args, commands.commands.get(args[0]));
      } else {
        printMsg(msg, lang.error.invalidArg.cmd);
      }
    } else {
      //Print all commands
      printCmds(msg);
    }
  }
}

//Create the help message
function printCmds(msg) {
  var numSpace = 18;
  var rows = '';
  var rowNum = 0;
  var columnsFinished = 0;

  //Order categories
  var categories = new Map(Array.from(commands.categories).sort((a, b) => {
    return b[1].priority - a[1].priority
  }));

  //Create message
  while (columnsFinished < categories.size) {
    var row = '';
    if (rowNum == 0) {
      //Insert categories
      categories.forEach(category => {
        var chars = `[${category.name}]`;
        row += chars + Array(numSpace - chars.length).join(" ")

        //Order commands
        category.commands = new Map(Array.from(category.commands).sort((a, b) => {
          return b[1].priority - a[1].priority
        }));
        //Add iterator
        category.iterator = category.commands.values();
        //Add done
        category.done = false;
      });
    } else {
      //Insert commands
      //Add a space before (prettier)
      row = ' '
      categories.forEach(category => {
        var chars = '';
        var command = category.iterator.next();
        if (!command.done) {
          chars = config.prefix + command.value.name;
        } else {
          if (!category.done) {
            //Category/column finished
            columnsFinished++;
            category.done = true;
          }
        }
        row += chars + Array(numSpace - chars.length).join(' ');
      });
    }
    rows += `${row}\n`;
    rowNum++;
  }
  msg.channel.send([rows], {
    code: 'css'
  });
  msg.channel.send(mustache.render(lang.help.msg, {
    config
  }));
}

function printCmd(msg, args, cmd) {
  var help = lang.help[args[0]];

  if (help != undefined) {
    const Discord = require("discord.js");

    var usages = '';
    for (var i = 0; i < help.usages.length; i++) {
      //Insert usages
      usages += `${config.prefix + args[0]} ${help.usages[i]}\n`;
    }

    var embed = new Discord.RichEmbed();
    embed.title = config.prefix + args[0];
    embed.color = 0x00ff00;

    var aliases = cmd.aliases;
    //Check for aliases
    if (aliases.length > 0) {
      embed.setDescription(`${lang.help.alias} ${aliases.map(x => `\`${config.prefix + x}\``).join(' ')}`);
    }
    embed.addField(lang.help.desc, help.msg, false);
    embed.addField(lang.help.permLvl, cmd.permLvl, true);
    embed.addField(lang.help.usage, usages, true);
    msg.channel.send({
      embed
    });
  } else {
    console.log(lang.error.notLocalized.cmd);
  }
}
