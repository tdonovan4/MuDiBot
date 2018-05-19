const config = require('../../args.js').getConfig()[1];
const bot = require('../../bot.js')
const mustache = require('mustache');
const commands = require('../../commands.js');
var categories = commands.categories;
var lang = require('../../localization.js').getLocalization();

module.exports = class helpCommand extends bot.Command {
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
        bot.printMsg(msg, lang.error.invalidArg.cmd);
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
  categories = new Map(Array.from(categories).sort((a, b) => {
    return b[1].priority - a[1].priority
  }));

  //Create message
  while (columnsFinished < categories.size) {
    var row = '';
    if (rowNum == 0) {
      //Insert categories
      categories.forEach(function(category) {
        var chars = `[${category.name}]`;
        row += chars + Array(numSpace - chars.length).join(" ")

        //Order commands
        category.commands = new Map(Array.from(category.commands).sort((a, b) => {
          return b[1].priority - a[1].priority
        }));
      });
    } else {
      //Insert commands
      //Add a space before (prettier)
      row = ' '
      categories.forEach(function(category) {
        var chars = '';
        var command = category.commands.values().next();

        if (!command.done) {
          chars = config.prefix + command.value.name;
          //Delete command
          categories.get(category.name).commands.delete(command.value.name);
          if (category.commands.values().next().done) {
            //Done
            columnsFinished++;
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
    embed.addField(name = lang.help.desc, value = help.msg, inline = false);
    embed.addField(name = lang.help.permLvl, value = cmd.permLvl, inline = true);
    embed.addField(name = lang.help.usage, value = usages, inline = true);
    msg.channel.send({
      embed
    });
  } else {
    console.log(lang.error.notLocalized.cmd);
  }
}
