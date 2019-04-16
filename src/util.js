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
  }
}
