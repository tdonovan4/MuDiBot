//Main class
const Discord = require("discord.js");
const client = new Discord.Client();
const defaultChannel = require('./default-channel.js');
const mustache = require('mustache');
var config = require('./args.js').getConfig()[1];
//For localization
var lang = require('./localization.js').getLocalization();

module.exports = {
  printMsg: function(msg, text) {
    console.log(text);
    msg.channel.send(text);
  },
  client: function() {
    return client;
  },
  Command: class {
    constructor(commandInfo) {
      this.name = commandInfo.name;
      this.aliases = commandInfo.aliases;
      this.category = commandInfo.category;
      this.priority = commandInfo.priority;
      this.permLvl = commandInfo.permLvl;
    }
  },
  Category: class {
    constructor(categoryInfo) {
      this.name = categoryInfo.name;
      this.priority = categoryInfo.priority;
      this.commands = new Map();
    }
    addCommand(command) {
      this.commands.set(command.name, command);
    }
  }
}

//Log to the discord user  with the token
var startTime;
client.login(config.botToken)
  .then(startTime = Date.now()).catch(() => {
    console.log(lang.error.invalidArg.token);
    process.exitCode = 1;
    process.exit();
  });

const commands = require('./commands.js');
const customCmd = require('./modules/fun/custom-cmd.js');

//Start the bot
client.on('ready', () => {
  console.log(mustache.render(lang.general.logged, client));
  console.log(lang.general.language);

  //Register stuff
  commands.registerCategories(config.categories);
  commands.registerCommands();

  //Set status
  client.user.setActivity(config.currentStatus);
  //Display startup time
  var time = Date.now() - startTime; +
  console.log(mustache.render(lang.general.startupTime, {
    time
  }));
});

const levels = require('./levels.js');

/*
 *Function fired when a message is posted
 *to check if the message is calling a command
 */
client.on('message', msg => {
  onMessage(msg);
});

async function onMessage(msg) {
  //Just to make it async
  //Ignore bot
  if (msg.author.bot) return;
  //Check if the author is not the bot
  if (msg.author != client.user) {
    let cmd = msg.content.slice(config.prefix.length);
    if (cmd != undefined) {
      cmd = cmd.split(' ');
    }

    //Check if message is a command that can be executed
    var msgValidCmd = await commands.checkIfValidCmd(msg, cmd);
    if (msgValidCmd) {
      await commands.executeCmd(msg, cmd);
    } else {
      //Check if message is a custom command
      var custCmds = await customCmd.getCmds(msg);
      //The custom command if it exists
      var custCmd = custCmds.find(x => x.name == msg.content);
      if (custCmd != undefined) {
        customCmd.executeCmd(msg, custCmd);
      }
    }
    if (config.levels.activated == true) {
      //Add xp
      await levels.newMessage(msg);
    }
  }
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
