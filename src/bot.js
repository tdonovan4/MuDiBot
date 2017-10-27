//Main class
const Discord = require("discord.js");
const client = new Discord.Client();
const data = require('./localization.json');
const warning = require('./warning.js');
const player = require('./audio-player.js');
const levels = require('./levels.js');
const defaultChannel = require('./default-channel.js');
const fs = require('fs');
var config = require('../config.js');
var localization;

//Log to the discord user  with the token
client.login(config.botToken);

//Start the bot
client.on('ready', () => {
  console.log(`Logged in as ${client.user.username}!`);

  if (config.language === 'french') {
    localization = data.french
    console.log('french');
  } else {
    //Use english by default in case the chosen language is not found
    localization = data.english
    console.log('english');
  }
  client.user.setGame(config.status);
});

module.exports.printMsg = function(msg, text) {
  printMsg(msg, text);
}

function printMsg(msg, text) {
  console.log(text);
  msg.channel.send(text);
}

/*
 *Use an object containing command objects to get
 *the permission needed and execute the command
 */
var commands = {
  help: {
    //Display a list of commands and their usage
    permLvl: "everyone",
    category: "General",
    execute: function(msg) {
      const help = require('./help.js');
      let args = msg.content.split(" ").slice(1);

      if (args[0] != undefined) {
        //Check if args is a valid command
        if (args[0] in commands) {
          //Valid command
          help.printCmd(msg, localization, commands[args[0]]);
        } else {
          printMsg(msg, 'This is not a valid command');
        }
      } else {
        //Print all commands
        help.printCmds(msg, Object.entries(commands));
      }
    }
  },
  ping: {
    //Reply "Pong!"
    permLvl: "everyone",
    category: "General",
    execute: function(msg) {
      msg.reply(localization.replies.ping);
      console.log("Pong!");
    }
  },
  info: {
    //Display info about the client
    permLvl: "everyone",
    category: "General",
    execute: function(msg) {
      var pjson = require('../package.json');
      var info = localization.info;

      var embed = new Discord.RichEmbed();
      embed.title = `__**${info.title}**__`;
      embed.color = 0x0080c0;
      embed.addField(name = `**${info.general.title}**`, value = `
        **${info.general.name}:** ${pjson.name}
        **${info.general.desc}:** ${pjson.description}
        **${info.general.author}:** ${pjson.author}
        **${info.general.version}:** ${pjson.version}
        **${info.general.uptime}:** ${time()}`.replace(/^( *)/gm,''), inline = false)
      embed.addField(name = `**${info.config.title}**`, value = `
        **${info.config.language}:** ${config.language}
        **${info.config.roleMember}:** ${config.roleMember}
        **${info.config.roleModo}:** ${config.roleModo}`.replace(/^( *)/gm,''), inline = false)
      embed.setFooter(text = `${info.footer.clientId}: ${client.user.id}`)

      msg.channel.send({
        embed
      });
    }
  },
  status: {
    permLvl: "roleModo",
    category: "General",
    execute: function(msg) {
      var newStatus = msg.content.split(`${config.prefix}status `).slice(1);
      client.user.setGame(newStatus[0]);

      modifyText('./config.js', 'status: \'' + config.status, 'status: \'' + newStatus[0]);
      config.status = newStatus[0];
    }
  },
  say: {
    permLvl: "roleModo",
    category: "General",
    execute: function(msg) {
      let messageToSay = msg.content.split(' ').slice(1);
      let channel;

      //Try to find which channel to send message
      if (messageToSay[0] == 'here') {
        channel = msg.channel;
      } else {
        let id = messageToSay[0].match(/<#(.*?)>/);
        if (id != undefined) {
          channel = client.channels.get(id[1]);
        }
      }

      messageToSay = messageToSay.slice(1).join(' ');

      //Check arguments
      if (channel == undefined) {
        channel = msg.channel;
        messageToSay = 'Missing argument: channel';
      }

      console.log(messageToSay);
      if (messageToSay == undefined || messageToSay == '') {
        messageToSay = 'Missing argument: message';
      }

      //Send message
      channel.send(messageToSay);
    }
  },
  avatar: {
    permLvl: "everyone",
    category: "User",
    execute: function(msg) {
      var user = msg.mentions.users.first()
      if (user != undefined && user != null) {
        printMsg(msg, user.avatarURL);
      } else {
        printMsg(msg, "Invalid user");
      }
    }
  },
  profile: {
    permLvl: "everyone",
    category: "User",
    execute: async function(msg) {
      const storage = require('./storage.js');
      let user = msg.mentions.users.first();
      if (user == undefined) {
        //There is no mentions
        user = msg.author;
      }

      let userData = await storage.getUser(msg, user.id);
      let progression = levels.getProgression(userData.xp);
      let level = progression[0];
      let xpToNextLevel = `${progression[1]}/${levels.getXpForLevel(level)}`;

      var embed = new Discord.RichEmbed();
      embed.title = `${user.username}'s profile`;
      embed.setThumbnail(url = user.avatarURL)
      embed.addField(name = "Level: ", value = `${level} (${xpToNextLevel})`, inline = true)
      embed.addField(name = "Warnings", value = userData.warnings, inline = true)
      embed.addField(name = "Total XP", value = userData.xp, inline = true)
      embed.setFooter(text = `Client id: ${user.id}`)
      msg.channel.send({
        embed
      });
    }
  },
  gif: {
    //A GIF of a robot, just a funny little feature
    permLvl: "roleMember",
    category: "Fun",
    execute: function(msg) {
      msg.reply('http://giphy.com/gifs/l4FGBpKfVMG4qraJG');
    }
  },
  hello: {
    //Play a greeting sound and reply hi
    permLvl: "everyone",
    category: "Fun",
    execute: function(msg) {
      player.play('hello', msg);
      msg.reply(localization.replies.hello);
    }
  },
  tnt: {
    //Play a big boom!
    permLvl: "everyone",
    category: "Fun",
    execute: function(msg) {
      msg.reply(localization.replies.tnt);
      player.play('tnt', msg);
    }
  },
  flipcoin: {
    //Flip a coin
    permLvl: "everyone",
    category: "Fun",
    execute: function(msg) {
      msg.reply(Math.floor(Math.random() * 2) == 0 ? 'heads' : 'tails');
    }
  },
  roll: {
    //Flip a coin
    permLvl: "everyone",
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
  play: {
    //Play a song on YouTube
    permLvl: "everyone",
    category: "Music",
    execute: function(msg) {
      player.playYoutube(msg, msg.content.split(" ").slice(1));
    }
  },
  stop: {
    //Stop the voice connection and leave voice channel
    permLvl: "everyone",
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
    permLvl: "everyone",
    category: "Music",
    execute: function(msg) {
      player.listQueue(msg);
    }
  },
  clearlog: {
    //Clear listed commands
    permLvl: "roleModo",
    category: "Moderation",
    execute: function(msg) {
      //Split the message to get only the argument
      let args = msg.content.split(" ").slice(1);
      let numToDel = args[0];

      //In case the argument isn't a valid number
      if (numToDel === null || isNaN(numToDel)) {
        numToDel = '50';
      }
      clear(msg, numToDel);
    }
  },
  warn: {
    //Handle warnings
    permLvl: "roleModo",
    category: "Moderation",
    execute: function(msg) {
      warning.warn(msg);
    }
  },
  kill: {
    //Kill the process
    permLvl: "roleModo",
    category: "Moderation",
    execute: function(msg) {
      console.log('Shutting down...');
      process.exitCode = 0;
      process.exit();
    }
  },
  restart: {
    //Restart the client
    permLvl: "roleModo",
    category: "Moderation",
    execute: function() {
      //Spawn new process
      var spawn = require('child_process').spawn;

      var child = spawn('node', ['./src/bot.js'], {
        detached: true,
        shell: true,
        stdio: 'ignore'
      });
      child.unref();

      console.log('Restarting');

      //Exit this process
      process.exitCode = 0;
      process.exit();
    }
  },
  setchannel: {
    permLvl: "roleModo",
    category: "Moderation",
    execute: function(msg) {
      var botChannel = msg.channel;
      //Modify default channel in database
      defaultChannel.setChannel(msg, botChannel);
      botChannel.send('New default channel set!')
    }
  }
}

var keys = Object.keys(commands);

/*
*Function fired when a message is posted
*to check if the message is calli
ng a command
*/
client.on('message', msg => {
  //Ignore bot
  if (msg.author.bot) return;
  levels.newMessage(msg);
  //Check if the author is not the bot and if message begins with prefix
  if (msg.author != client.user &&
    msg.content.substring(0, config.prefix.length) == config.prefix) {
    let cmd = msg.content.split(config.prefix).slice(1);

    if (cmd[0] != undefined) {
      cmd = cmd[0].split(' ');
    }

    if (cmd[0] in commands) {
      console.log(msg.author.username + ' - ' + msg.content);
      commands[cmd[0]].execute(msg);
    }
  }
});

//Format time
function time() {
  var time = process.uptime();
  var days = ~~(time / 86400)
  var hrs = ~~((time % 86400) / 3600);
  var mins = ~~((time % 3600) / 60);
  var secs = ~~(time % 60);
  return days + 'd:' + hrs + 'h:' + mins + 'm:' + secs + 's'
}

function modifyText(file, text, value) {
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

//Function that fetch, check and delete messages
function clear(msg, num) {
  var clearList = config.commandsToClear.concat(config.usersToClear);
  for (i = 0; i < keys.length; i++) {
    clearList.push(config.prefix + keys[i]);
  }

  //Fetch
  msg.channel.fetchMessages({
      limit: parseInt(num)
    })
    .then(messages => {
      console.log("Max messages to delete: " + num);
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
      console.log(deletedMessages + ' messages deleted!');
    })
    .catch(console.error);
}

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
/*
 *Check if the message author has permission
 *to do the command, return true or false
 */
function checkRole(msg, role) {
  var permLevel = 0;
  var currentPermLevel = 0;

  //Debug only, check if user is superuser
  for (i = 0; i < config.superusers.length; i++) {
    if (msg.author.id === config.superusers[i]) {
      return true;
    }
  }

  //Check if user is an administrator
  var permissions = msg.member.permissions;
  if (permissions.hasPermission('ADMINISTRATOR') || permissions.hasPermission('MANAGE_CHANNELS')) {
    return true;
  }

  //Set the required level of permission
  if (role === roleMember) {
    permLevel = 1;
  } else if (role === roleModo) {
    permLevel = 2;
  }

  //Set the user permission level
  for (i = 0; i < msg.member.roles.array().length; i++) {
    if (msg.member.roles.array()[i].name === config.roleModo) {
      currentPermLevel = 2;
      break;
    }
    if (msg.member.roles.array()[i].name === config.roleMember) {
      currentPermLevel = 1;
    }
  }

  //Compare user and needed permission level
  if (currentPermLevel < permLevel) {
    console.log("Not enough permissions");
    return false;
  } else {
    return true;
  }
}

async function sendDefaultChannel(member, text) {
  let channel = await defaultChannel.getChannel(client, member);
  channel.send(text);
}

//When users join the server
client.on('guildMemberAdd', member => {
  sendDefaultChannel(member, `Welcome to the server, ${member}!`);
});

//When users leave the server
client.on('guildMemberRemove', member => {
  sendDefaultChannel(member, `${member} left the server :slight_frown:`);
});

//Make sure the process exits correctly and don't fails to close
process.on('SIGINT', function() {
  process.exit(2);
});
