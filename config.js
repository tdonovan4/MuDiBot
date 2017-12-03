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
  //List of users (id) with all permissions
  superusers: [''],

  /*===============
  	-Roles-
  ===============*/
  //Will soon be deprecated
  //Role name for "botMember"
  roleMember: '',
  //Role name for "botModo"
  roleModo: '',

  /*===============
  	-Modules-
  ===============*/

  /*---------------
  -Xp and levels-
  ---------------*/
  levels: {
    //Is this module activated? Set to false to disable the module
    activated: true
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
  They also can be activated or desactivated.
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
  }
}
