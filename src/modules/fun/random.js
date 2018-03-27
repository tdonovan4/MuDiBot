const bot = require('../../bot.js');
var lang = require('../../localization.js').getLocalization();

module.exports = {
  FlipCoinCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'flipcoin',
        aliases: [],
        category: 'fun',
        permLvl: 0
      });
    }
    execute(msg, args) {
      msg.reply(Math.floor(Math.random() * 2) == 0 ? lang.flipcoin.heads : lang.flipcoin.tails);
    }
  },
  RollCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'roll',
        aliases: [],
        category: 'fun',
        permLvl: 0
      });
    }
    execute(msg, args) {
      args = msg.content.split(/[ d+]|(?=-)/g).slice(1);
      var num = isNaN(args[2]) ? 0 : parseInt(args[2]);
      console.log(num)
      for (i = 0; i < args[0]; i++) {
        num += Math.floor(Math.random() * args[1]) + 1;
      }
      msg.reply(num);
    }
  }
}
