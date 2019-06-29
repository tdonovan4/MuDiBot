const Discord = require("discord.js");

module.exports = {
  login: function(token) {
    return new Promise(function(resolve) {
      resolve(token != null);
    });
  },
  on: function() {
    return new Promise(function(resolve) {
      //Placeholder
      resolve(true);
    });
  },
  guilds: new Discord.Collection(),
  channels: new Discord.Collection(),
  user: {
    id: 'testID',
    setActivity: function(game) {
      return (game)
    }
  },
  users: new Discord.Collection(),
  fetchUser: function(id) {
    return id;
  },
  ping: '50'
}
