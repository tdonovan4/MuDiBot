const { Socket } = require('net');

module.exports = {
  getConfig: function() {
    //Check if there is an environment variable for custom config
    var customConfig = process.env.CONFIG

    var config = customConfig == undefined ? '../config.js' : customConfig;
    return [config, require(config)];
  },
  getUserFromArg: function(msg, arg) {
    return msg.guild.members.get(arg.match(/<@!?(.*?[0-9])>/)[1]).user;
  },
  printMsg: function(msg, text) {
    console.log(text);
    msg.channel.send(text);
  },
  checkIfPortClosed: function(port) {
    let socket = new Socket()
    return new Promise(function(resolve) {
      socket.once('connect', function() {
        //In use
        socket.destroy();
        resolve(false);
      });
      socket.once('error', function() {
        //Not listening
        resolve(true);
      });
      socket.connect(port, '127.0.0.1');
    });
  }
}
