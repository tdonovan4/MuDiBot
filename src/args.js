module.exports = {
  getConfig: function() {
    //Check if there is an environment variable for custom config
    var customConfig = process.env.CONFIG

    var config = customConfig == undefined ? '../config.js': customConfig;
    return [config, require(config)];
  }
}
