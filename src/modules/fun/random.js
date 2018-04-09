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
        priority: 7,
        permLvl: 0
      });
    }
    execute(msg, args) {
      args = msg.content.split(/[ d+]|(?=-)/g).slice(1);
      var invalid = false;
      function checkIfValid(string) {
        //Return false if whitespace because apparently " " is a number in JavaScript
        if(string == /\s/g.test(string)) {
          return false;
        }
        result = isNaN(string) || string > 50;
        return !result;
      }
      //Get values
      var numDice = 1;
      if (checkIfValid(args[0]) || args[0] > 1){
        numDice = parseInt(args[0]);
      } else {
        invalid = true;
      }
      var die = 6;
      if (checkIfValid(args[1])) {
        die = parseInt(args[1]);
      } else {
        invalid = true;
      }
      var bonus = checkIfValid(args[2]) ? parseInt(args[2]) : 0;
      //RNG
      var dice = [];
      for (var i = 0; i < numDice; i++) {
        dice.push(Math.floor(Math.random() * die) + 1);
      }
      //Make message
      var reply = '';
      if (invalid) {
        //print warning message
        reply += lang.roll.invalid;
      }
      reply += `(${dice.join(' + ')})`;
      if (bonus > 0) {
        reply += ` + ${bonus}`;
      }
      reply += ` = ${dice.reduce((a, b) => a+b) + bonus}`;
      msg.channel.send(reply);
    }
  }
}
