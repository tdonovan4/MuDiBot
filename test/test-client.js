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
  channels: new Discord.Collection(),
  user: {
    id: 'testID',
    setGame: function(game) {
      return(game)
    }
  }
}

module.exports.channels.set('42', {
  send: function(text) {
    return text;
  }
});
