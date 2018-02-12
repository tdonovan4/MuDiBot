const config = require('./args.js').getConfig();
const mustache = require('mustache');
var lang = require('./localization.js').getLocalization();

module.exports = {
  //Create the help message
  printCmds: function(msg, cmds) {

    var categories = {
      General: [],
      User: [],
      Fun: [],
      Music: [],
      Warnings: [],
      Administration: []
    };

    //Add commands to categories
    for (var i = 0; i < cmds.length; i++) {
      if (cmds[i][1].aliasOf == undefined) {
        var category = cmds[i][1].category;
        if (category in categories) {
          categories[category].push(cmds[i][0]);
        } else {
          console.log(mustache.render(lang.error.invalidArg.category, {
            cmds: cmds[i][0]
          }));
        }
      }
    }


    categories = Object.entries(categories)

    var numSpace = 18;
    var rows = '';
    var rowNum = 0;
    var columnsFinished = 0;

    //Create message
    while (columnsFinished < categories.length) {
      var row = '';
      if (rowNum == 0) {
        //Insert categories
        for (var i = 0; i < categories.length; i++) {
          var chars = `[${categories[i][0]}]`;
          row += chars + Array(numSpace - chars.length).join(" ")
        }
      } else {
        //Insert commands
        //Add a space before (prettier)
        row = ' '
        for (var i = 0; i < categories.length; i++) {
          var chars = '';
          //Check if there is still commands
          if (categories[i][1].length > 0) {
            chars = config.prefix + categories[i][1][0];
            //Remove the command
            categories[i][1].splice(0, 1);
            if (categories[i][1].length == 0) {
              //No more commands, the column is finished
              columnsFinished++;
            }
          }
          row += chars + Array(numSpace - chars.length).join(" ");
        }
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
  },
  printCmd: function(msg, cmds) {
    var args = msg.content.split(" ").slice(1);
    var cmd = cmds[args[0]];
    var help = lang.help[args[0]];

    if (help != undefined) {
      const Discord = require("discord.js");

      var usages = '';
      for (var i = 0; i < help.usages.length; i++) {
        //Insert usages
        usages += `${config.prefix + args[0]} ${help.usages[i]}\n`
      }

      var embed = new Discord.RichEmbed();
      embed.title = config.prefix + args[0];
      embed.color = 0x00ff00;

      var aliases = Object.entries(cmds).filter(x => x[1].aliasOf == args[0]);
      //Check for aliases
      if (aliases.length > 0) {
        embed.setDescription(`${lang.help.alias} ${aliases.map(x => `\`$${x[0]}\``).join(' ')}`)
      }
      embed.addField(name = lang.help.desc, value = help.msg, inline = false)
      embed.addField(name = lang.help.permLvl, value = cmd.permLvl, inline = true)
      embed.addField(name = lang.help.usage, value = usages, inline = true);
      msg.channel.send({
        embed
      });
    } else {
      console.log(lang.error.notLocalized.cmd);
    }
  }
}
