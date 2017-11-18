function checkFor(args, target) {
  for (var i = 0; i < args.length; i++) {
    if (args[i].substring(0, 8) == target) {
      return args[i + 1];
      console.log(target);
    }
  }
}

module.exports = {
  getConfig: function() {
    var args = process.argv.slice(2);
    //Check if an argument starts with --config
    var customConfig = checkFor(args, '--config');

    var config = customConfig == undefined ? '../config.js': customConfig;
    return require(config);
  }
}
