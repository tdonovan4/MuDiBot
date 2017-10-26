const config = require('../config.js');

module.exports = {
  //Create the help message
  printCmds: function(msg, cmds) {
    //const help = localization.help;
    var roles = msg.channel.guild.roles;

    var categories = {
      General: [],
      User: [],
      Fun: [],
      Music: [],
      Moderation: []
    };

    //Add commands to categories
    for (var i = 0; i < cmds.length; i++) {
      var category = cmds[i][1].category;
      if (category in categories) {
        categories[category].push(cmds[i][0]);
      } else {
        console.log(`Warning: ${cmds[i]} doesn't have a valid category`)
      }
    }


    categories = Object.entries(categories)

    var numSpace = 15;
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
    msg.channel.send(`For more information about a command and its usage, type \`${config.prefix}help CommandName\``);
  },
  printCmd: function(msg, localization, cmd) {
    var args = msg.content.split(" ").slice(1);
    var help = localization.help[args[0]];

    if (help != undefined) {
      const Discord = require("discord.js");
      var output = [];
      for (var i = 0; i < help.length; i++) {
        //output += `${config.prefix + help[i].name}:${help[i].args} [${cmd.permLvl}] ${help[i].msg}`;
        var embed = new Discord.RichEmbed();
        embed.title = config.prefix + help[i].name;
        embed.color = 0x00ff00;
        embed.addField(name = "Description: ", value = help[i].msg, inline = false)
        embed.addField(name = "Permission level", value = cmd.permLvl, inline = true)
        embed.addField(name = "Usage", value = config.prefix + help[i].name + help[i].args, inline = true)
        msg.channel.send({
          embed
        });
      }
    } else {
      console.log('Error: this command is not localized');
    }
  }
}
