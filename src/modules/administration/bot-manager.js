const { Command } = require('../../commands.js');
var lang = require('../../localization.js').getLocalization();

module.exports = {
  KillCommand: class extends Command {
    constructor() {
      super({
        name: 'kill',
        aliases: [],
        category: 'administration',
        priority: 9,
        //Only for superusers
        permLvl: 99
      });
    }
    execute() {
      console.log(lang.general.stopping);
      process.exitCode = 0;
      process.exit();
    }
  },
  RestartCommand: class extends Command {
    constructor() {
      super({
        name: 'restart',
        aliases: [],
        category: 'administration',
        priority: 8,
        //Only for superusers
        permLvl: 99
      });
    }
    execute() {
      //Spawn new process
      var spawn = require('child_process').spawn;

      var child = spawn('node', ['./src/bot.js'], {
        detached: true,
        shell: true,
        stdio: 'ignore'
      });
      child.unref();

      console.log(lang.general.restarting);

      //Exit this process
      process.exitCode = 0;
      process.exit();
    }
  }
}
