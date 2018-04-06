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
      priority: 10,
      permLvl: 3
    });
  }
  execute(msg, args) {
    let numToDel = args[0];

    //In case the argument isn't a valid number
    if (numToDel == null || isNaN(numToDel)) {
      numToDel = '50';
    }
    //Add bot commands to list
    var clearList = [];
    commands.forEach(function(val) {
      clearList.push(config.prefix + val.name);
    });
    //Add specials commands to clear to list
    clearList = clearList.concat(config.clearlog.commandsToClear);
    //Add users
    var usersToClear = config.clearlog.usersToClear.filter(x => x != '');
    //Remove empty string from list
    clearList = clearList.filter(x => x != '');

    clear(msg, clearList, usersToClear, numToDel);
  }
}

//Function that fetch, check and delete messages
function clear(msg, strings, users, num) {
  //Add bot user to list of users to delete
  users.push(client.user.id);

  //Fetch a specific number of messages
  msg.channel.fetchMessages({
      limit: parseInt(num)
    })
    .then(messages => {
      messages = messages.array()
      console.log(lang.clearlog.maxNum + num);
      //Filter message by author and content
      messages = messages.filter(message => {
        return users.some(user => user == message.author.id) ||
          strings.some(string => message.content.startsWith(string));
      });
      var deletedMessages = messages.length;

      //Delete messages
      messages.forEach(message => {
        message.delete();
      })
      console.log(mustache.render(lang.clearlog.deleted, {
        deletedMessages
      }));
    })
    .catch(console.error);
}
