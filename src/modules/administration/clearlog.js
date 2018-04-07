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
    var clearList = [];
    var usersToClear = [];
    var filter = false;

    if(args.length > 1) {
      var mention = msg.mentions.users.first();

      //Use filters
      if(mention != undefined) {
        usersToClear.push(mention.id);
        //Delete mention in args
        args[args.findIndex(x => x == `<@${mention.id}>`)] = '';
      }
      clearList.push(args.slice(0, args.length - 1).filter(x => x != '').join(' '));
      filter = true;
    } else {
      //Remove regular commands + configured commands and users
      //Add bot commands to list
      commands.forEach(function(val) {
        clearList.push(config.prefix + val.name);
      });
      //Add specials commands to clear to list
      clearList = clearList.concat(config.clearlog.commandsToClear);
      //Add users
      usersToClear = config.clearlog.usersToClear;
    }

    let numToDel = args[args.length-1];

    //In case the number to delete isn't a valid number
    if (numToDel == null || isNaN(numToDel)) {
      numToDel = '50';
    }

    clear(msg, clearList, usersToClear, numToDel, filter);
  }
}

//Function that fetch, check and delete messages
function clear(msg, strings, users, num, filter) {
  //Add bot user to list of users to delete
  if(!filter) {
    users.push(client.user.id);
  }

  //Remove empty string from lists
  strings = strings.filter(x => x != '');
  users = users.filter(x => x != '');

  //Fetch a specific number of messages
  msg.channel.fetchMessages({
      limit: parseInt(num)
    })
    .then(messages => {
      messages = messages.array()
      console.log(lang.clearlog.maxNum + num);
      //Filter message by author and content
      messages = messages.filter(message => {
        containsUser = users.some(user => user == message.author.id);
        containsString = strings.some(string => message.content.startsWith(string));
        if(filter) {
          return (containsUser || users.length == 0) &&
          (containsString || strings.length == 0);
        }
        //Default
        return containsUser || containsString;
      });
      var deletedMessages = messages.length;

      //Delete messages
      messages.forEach(message => {
        try {
          message.delete()
        }
        catch(e) {
          console.log(e)
        }
      })
      console.log(mustache.render(lang.clearlog.deleted, {
        deletedMessages
      }));
    })
    .catch(console.error);
}
