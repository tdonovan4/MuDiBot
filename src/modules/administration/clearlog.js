const bot = require('../../bot.js');
const config = require('../../args.js').getConfig()[1];
const commands = require('../../commands.js').commands;
const mustache = require('mustache');
var client = bot.client();
var lang = require('../../localization.js').getLocalization();

module.exports = class ClearlogCommand extends bot.Command {
  constructor() {
    super({
      name: 'clearlog',
      aliases: [],
      category: 'administration',
      permLvl: 3
    });
  }
  execute(msg, args) {
    let numToDel = args[0];

    //In case the argument isn't a valid number
    if (numToDel == null || isNaN(numToDel)) {
      numToDel = '50';
    }
    clear(msg, numToDel);
  }
}

//Function that fetch, check and delete messages
function clear(msg, num) {
  //Add command and users to clear to list
  var clearList = config.clearlog.commandsToClear.concat(config.clearlog.usersToClear);
  //Add bot commands to list
  var commandList = [];
  commands.forEach(function(val) {
    commandList.push(config.prefix + val.name);
  });
  clearList = clearList.concat(commandList);
  //Remove empty string from list
  clearList = clearList.filter(x => x != '');

  //Fetch
  msg.channel.fetchMessages({
      limit: parseInt(num)
    })
    .then(messages => {
      console.log(lang.clearlog.maxNum + num);
      var messages = messages.array();
      var deletedMessages = 0;

      //Check messages
      for (var i = 0; i < messages.length; i++) {
        //Delete commands from bot
        if (messages[i].author.id === client.user.id) {
          messages[i].delete()
          deletedMessages++;
        } else {
          //Find and delete
          for (var n = 0; n < clearList.length; n++) {
            if (messages[i].content.substring(0, clearList[n].length) === clearList[n] || messages[i].author.id === clearList[n]) {
              messages[i].delete()
              deletedMessages++;
              break
            }
          }
        }
      }
      console.log(mustache.render(lang.clearlog.deleted, {
        deletedMessages
      }));
    })
    .catch(console.error);
}
