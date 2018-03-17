//Main class
const Discord = require("discord.js");
const client = new Discord.Client();
const defaultChannel = require('./default-channel.js');
const mustache = require('mustache');
var config = require('./args.js').getConfig()[1];
//For localization
var lang = require('./localization.js').getLocalization();

//Log to the discord user  with the token
var startTime;
client.login(config.botToken)
  .then(startTime = Date.now()).catch(() => {
    console.log(lang.error.invalidArg.token);
    process.exitCode = 1;
    process.exit();
  });

//Start the bot
client.on('ready', () => {
  console.log(mustache.render(lang.general.logged, client));
  console.log(lang.general.language);
  //Set status
  client.user.setActivity(config.currentStatus);
  //Display startup time
  var time = Date.now() - startTime; +
  console.log(mustache.render(lang.general.startupTime, {
    time
  }));
});

module.exports = {
  printMsg: function(msg, text) {
    console.log(text);
    msg.channel.send(text);
  },
  client: function() {
    return client;
  }
}

const commands = require('./commands.js')
const player = require('./audio-player.js');
const levels = require('./levels.js');

/*
 *Function fired when a message is posted
 *to check if the message is calling a command
 */
client.on('message', msg => {
  //Ignore bot
  if (msg.author.bot) return;

  //Check if the author is not the bot
  if (msg.author != client.user) {
    let cmd = msg.content.slice(config.prefix.length);
    if(cmd != undefined) {
      cmd = cmd.split(' ');
    }

    //Check if message is a command that can be executed
    var msgValidCmd = commands.checkIfValidCmd(msg, cmd);

    if(msgValidCmd) {
      commands.executeCmd(msg, cmd);
    } else {
      //Check if message is a custom command
      const customCmd = require('./custom-cmd.js');

      customCmd.getCmds(msg).then(custCmds => {
        var cmd = custCmds.find(x => x.name == msg.content);
        if (cmd != undefined) {
          switch (cmd.action) {
            case 'say':
              msg.channel.send(cmd.arg);
              break;
            case 'play':
              player.playYoutube(msg, cmd.arg);
              break;
            default:
              console.log(lang.error.invalidArg.cmd);
          }
        }
      });
    }
    if (config.levels.activated == true) {
      //Add xp
      levels.newMessage(msg);
    }
  }
});

//Convert roles into mention objects
function mention(roles, role) {
  if (role === 'everyone') {
    return '@everyone';
  } else if (role === "roleMember") {
    return roles.find("name", config.roleMember);
  } else if (role === "roleModo") {
    return roles.find("name", config.roleModo);
  } else {
    return null;
  }
}

async function sendDefaultChannel(member, text) {
  let channel = await defaultChannel.getChannel(client, member);
  channel.send(text);
}

//When users join the server
client.on('guildMemberAdd', member => {
  if (config.greeting.activated == true) {
    sendDefaultChannel(member, mustache.render(lang.general.member.joined, {
      member
    }));
  }
});

//When users leave the server
client.on('guildMemberRemove', member => {
  if (config.farewell.activated == true) {
    sendDefaultChannel(member, mustache.render(lang.general.member.left, {
      member
    }));
  }
});

//Make sure the process exits correctly and don't fails to close
process.on('SIGINT', function() {
  process.exit(2);
});
