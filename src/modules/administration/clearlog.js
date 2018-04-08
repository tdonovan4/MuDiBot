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
  async execute(msg, args) {
    var clearList = [];
    var usersToClear = [];
    var filter = false;

    if (args.length > 1) {
      var mention = msg.mentions.users.first();

      //Use filters
      if (mention != undefined) {
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

    let numToDel = args[args.length - 1];

    //In case the number to delete isn't a valid number
    if (numToDel == null || isNaN(numToDel)) {
      numToDel = '50';
    }

    var messages = await getMsgToDelete(msg, clearList, usersToClear, numToDel, filter);
    //Send confirmation message
    var confirmationMsg = await msg.channel.send(mustache.render(lang.clearlog.confirm, messages));
    //React with two options
    await confirmationMsg.react('✅');
    await confirmationMsg.react('❌');
    //Collect reactions by author for the next 5 seconds
    var reaction = await confirmationMsg.awaitReactions((reaction, user) => {
      return ['✅', '❌'].indexOf(reaction.emoji.name) > -1 && user.id === msg.author.id;
    }, {max: 1, time: 5000});

    //Check if should delete the messages
    if(reaction.first().emoji.name === '✅') {
      deleteAll(messages);
    }
    //Delete the confirmation message
    confirmationMsg.delete();
  }
}

//Function that fetch and check messages
async function getMsgToDelete(msg, strings, users, num, filter) {
  //Add bot user to list of users to delete
  if (!filter) {
    users.push(client.user.id);
  }

  //Remove empty string from lists
  strings = strings.filter(x => x != '');
  users = users.filter(x => x != '');

  //Fetch a specific number of messages
  try {
    var messages = await msg.channel.fetchMessages({
      limit: parseInt(num)
    })
  } catch(e) {
    console.log(e);
  }
  messages = messages.array();
  console.log(lang.clearlog.maxNum + num);

  //Filter message by author and content
  messages = messages.filter(message => {
    containsUser = users.some(user => user == message.author.id);
    containsString = strings.some(string => message.content.startsWith(string));
    if (filter) {
      return (containsUser || users.length == 0) &&
        (containsString || strings.length == 0);
    }
    //Default
    return containsUser || containsString;
  });
  return messages;
}

function deleteAll(messages) {
  //Delete messages
  messages.forEach(message => {
    try {
      message.delete()
    } catch (e) {
      console.log(e)
    }
  })
  console.log(mustache.render(lang.clearlog.deleted, messages));
}