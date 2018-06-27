const bot = require('../../bot.js');
var lang = require('../../localization.js').getLocalization();

module.exports = {
  FlipCoinCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'flipcoin',
        aliases: [],
        category: 'fun',
        priority: 8,
        permLvl: 0
      });
    }
    execute(msg) {
      msg.reply(Math.floor(Math.random() * 2) == 0 ? lang.flipcoin.heads : lang.flipcoin.tails);
    }
  },
  RollCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'roll',
        aliases: [],
        category: 'fun',
        priority: 7,
        permLvl: 0
      });
    }
    execute(msg, args) {
      args = msg.content.split(/[ d+]|(?=-)/g).slice(1);
      var invalid = false;
      function checkIfValid(string) {
        if(string == /\s/g.test(string)) {
          return false;
        }
        var result = isNaN(string) || string > 50 || string < 1;
        return !result;
      }
      //Get values
      var values = [1, 6, 0];
      for(var i = 0; i < 2; i++) {
        if(checkIfValid(args[i])) {
          values[i] = parseInt(args[i]);
        } else {
          invalid = true;
        }
      }
      //Special for bonus
      if(!isNaN(args[2]) && args[2] <= 50) {
        values[2] = parseInt(args[2]);
      } else if(args[2] != undefined) {
        invalid = true;
      }
      //RNG
      var dice = [];
      for (var n = 0; n < values[0]; n++) {
        dice.push(Math.floor(Math.random() * values[1]) + 1);
      }
      //Make message
      var reply = '';
      if (invalid) {
        //print warning message
        reply += lang.roll.invalid;
      }
      reply += `(${dice.join(' + ')})`;
      if (values[2] > 0) {
        reply += ` + ${values[2]}`;
      } else if(values[2] < 0) {
        reply += ` - ${Math.abs(values[2])}`;
      }
      //Add total
      reply += ` = ${dice.reduce((a, b) => a+b) + values[2]}`;
      msg.channel.send(reply);
    }
  }
}
