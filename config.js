//Configuration file
//Please fill the fields
module.exports = {
  /*===============
  	-Credentials-
  ===============*/
  //The token of the bot
  botToken: '',
  //Your YouTube Data API key
  youtubeAPIKey: '',
  //Your GIPHY API key
  giphyAPIKey: '',

  /*===============
  	-General-
  ===============*/
  //The prefix for a command (for example $help)
  prefix: '$',
  //The locales for the localization (by default en-US or fr-FR)
  locale: '',
  //The 'game' the bot is playing (more like a status)
  currentStatus: 'Type $help',
  //The path to the database (default: './storage/data.db')
  pathDatabase: './storage/data.db',
  //List of users (id) with all permissions
  superusers: [''],

  /*===============
  	-Permission groups-
  ===============*/
  /*
  The groups used for permission
  Here are the permission levels:
  0: Default level, basic commands
  1: Still safe commands, but some can become a bit spammy
  (Entering danger zone)
  2: Commands for moderation
  3: Commands for administrating the bot or the guild/server
  */
  groups: [{
    name: "User",
    permLvl: 0
  }, {
    name: "Member",
    permLvl: 1
  }, {
    name: "Mod",
    permLvl: 2
  }, {
    name: "Admin",
    permLvl: 3
  }],
  /*===============
  	-Modules-
  ===============*/

  /*---------------
  -Xp and levels-
  ---------------*/
  levels: {
    //Is this module activated? Set to false to disable the module
    activated: true,
    //How much time between messages to be counted (in ms)
    cooldown: 3000,
    //Remove the role given by the last rank (if exists) after a rank up
    removeOldRole: true
  },

  /*---------------
  -Greetings and farewells-
  ---------------*/
  greeting: {
    //Is this module activated? Set to false to disable the module
    activated: true
  },
  farewell: {
    //Is this module activated? Set to false to disable the module
    activated: true
  },

  /*===============
  	-Commands-
  ===============*/

  /*Configuration for individual command.
  They also can be activated or deactivated.
  All commands are activated by default.*/

  /*---------------
  -Category: General-
  ---------------*/
  help: {
    //Is the command activated? Set to false to disable the command
    activated: true
  },

  ping: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  info: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  status: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  say: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  /*---------------
  -Category: User-
  ---------------*/
  avatar: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  profile: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  setgroup: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  unsetgroup: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  purgegroups: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  /*---------------
  -Category: Fun-
  ---------------*/
  gif: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  gifrandom: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  flipcoin: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  roll: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  play: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  stop: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  skip: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  queue: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },
  custcmd: {
    //Is the command activated? Set to false to disable a command
    activated: true,
    //The maximum number of custom commands an user can create
    maxCmdsPerUser: 5
  },
  custcmdlist: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },
  custcmdremove: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  /*---------------
  -Category: Warnings-
  ---------------*/
  warn: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  unwarn: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  warnlist: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  warnpurge: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  /*---------------
  -Category: Moderation-
  ---------------*/
  clearlog: {
    //Is the command activated? Set to false to disable a command
    activated: true,
    //List of commands to clear with "$clearlog"
    commandsToClear: [''],
    //List of users (id) to clear with "$clearlog"
    usersToClear: ['']
  },

  kill: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  restart: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  setchannel: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  setreward: {
    //Is the command activated? Set to false to disable a command
    activated: true
  },

  unsetreward: {
    //Is the command activated? Set to false to disable a command
    activated: true
  }
}
