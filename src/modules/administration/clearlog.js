const config = require('../../util.js').getConfig()[1];
const commands = require('../../commands.js');
const mustache = require('mustache');
const { client } = require('discord.js');
var lang = require('../../localization.js').getLocalization();

module.exports = class ClearlogCommand extends commands.Command {
  constructor() {
    super({
      name: 'clearlog',
      aliases: ['clearlogs', 'clear'],
      args: [
        new commands.Argument({
          optional: true,
          type: 'mention',
        }),
        new commands.Argument({
          optional: true,
        }),
        new commands.Argument({
          optional: true,
          type: 'int'
        }),
      ],
      category: 'administration',
      priority: 10,
      permLvl: 3
    });
  }
  async execute(msg, args) {
    var clearList = [];
    var usersToClear = [];
    var filter = false;

    let numToDel = args[args.length - 1];

    //In case the number to delete isn't a valid number
    if (isNaN(numToDel)) {
      numToDel = 50;
    } else {
      //Remove the number so that the other arguments work
      args.splice(args.length - 1);
      //Convert to int
      numToDel = parseInt(numToDel);
    }

    if (args.length > 0) {
      var mention = msg.mentions.users.last();

      //Use filters
      if (mention != undefined) {
        usersToClear.push(mention.id);
        //Delete mention in args (handle username and nickname)
        args[args.findIndex(x => x == `<@${mention.id}>` ||
          x == `<@!${mention.id}>`)] = '';
      }
      clearList.push(args.slice(0, args.length).filter(x => x != '').join(' '));
      filter = true;
    } else {
      //Remove regular commands + configured commands and users
      //Add bot commands to list
      commands.commands.forEach(function(val) {
        clearList.push(config.prefix + val.name);
      });
      //Add specials commands to clear to list
      clearList = clearList.concat(config.clearlog.commandsToClear);
      //Add users
      usersToClear = config.clearlog.usersToClear;
    }

    var messages = await getMsgToDelete(msg, clearList, usersToClear, numToDel, filter);
    //Send confirmation message (substract one because not counting calling cmd)
    var confirmationMsg = await msg.channel.send(
      mustache.render(
        lang.clearlog.confirm, {
          length: messages.length > 0 ? messages.length - 1 : 0
        })
    );
    //React with two options
    await confirmationMsg.react('✅');
    await confirmationMsg.react('❌');
    //Collect reactions by author for the next 5 seconds
    var reaction = await confirmationMsg.awaitReactions((reaction, user) => {
      return ['✅', '❌'].indexOf(reaction.emoji.name) > -1 && user.id === msg.author.id;
    }, { max: 1, time: 5000 });

    //Check if should delete the messages
    if (reaction.first() != undefined && reaction.first().emoji.name === '✅') {
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
      //The calling command doesn't count so +1
      limit: parseInt(num + 1)
    })
  } catch (e) {
    console.log(e);
  }
  messages = messages.array();
  console.log(lang.clearlog.maxNum + num);

  //Check if not special filter all
  if (strings[0] !== 'all' || strings.length > 1) {
    //Filter message by author and content
    messages = messages.filter(message => {
      var containsUser = users.some(user => user == message.author.id);
      var containsString = strings.some(string => message.content.startsWith(string));
      if (filter) {
        return (containsUser || users.length == 0) &&
          (containsString || strings.length == 0);
      }
      //Default
      return containsUser || containsString;
    });
  }
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
