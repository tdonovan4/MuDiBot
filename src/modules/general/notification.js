const schedule = require('node-schedule');
const db = require('../database/database.js');
const mustache = require('mustache');
const { client } = require('discord.js');
var lang = require('../../localization.js').getLocalization();

async function sendDefaultChannel(guild, text) {
  let channel = await db.config.getDefaultChannel(guild);
  channel.send(text);
}

//Execute everyday at 12:00, send notif about birthdays
var birthdays = schedule.scheduleJob('0 12 * * *', async function() {
  var date = new Date();
  //Local time, format: mm-dd
  var formatedDate = (date.getMonth() + 1).toString().padStart(2, '0') + '-' +
    date.getDate().toString().padStart(2, '0');
  //Special case for the bot's anniversary
  if (formatedDate === '04-06') {
    /*
     * This is a different message from the birthdays messages
     * that is send to all servers the bot is in.
     */
    let message = mustache.render(lang.general.botBirthday, {
      age: date.getFullYear() - 2017
    })
    //Send to all servers
    for (let guild of client.guilds.keys()) {
      await await sendDefaultChannel(guild, message);
    }
  }
  //Group users by server
  var users = await db.user.getUsersByBirthday(formatedDate);
  var groupedUsers = new Map();
  for (let user of users) {
    if (!groupedUsers.has(user.server_id)) {
      groupedUsers.set(user.server_id, []);
    }
    groupedUsers.get(user.server_id).push(`<@${user.user_id}>`);
  }
  //Send a message in each server
  for (let guildId of groupedUsers.keys()) {
    //Check if the guild exist
    if (!client.guilds.has(guildId)) {
      break;
    }
    let guild = client.guilds.get(guildId);
    //Get the users for the server and remove the users who left the server
    let birthdayUsers = groupedUsers.get(guildId).filter(birthdayUser => {
      let userId = /<@(.*?)>/.exec(birthdayUser)[1];
      return guild.members.has(userId);
    });
    //Create the message
    var message;
    if (birthdayUsers.length === 1) {
      //If only one birthday
      message = mustache.render(lang.general.member.birthday, {
        mention: birthdayUsers[0]
      });
    } else {
      //If multiple birthdays
      message = mustache.render(lang.general.birthdays, {
        users: birthdayUsers.join(', ')
      });
    }
    await sendDefaultChannel(guildId, message);
  }
});

module.exports.birthdays = birthdays;
module.exports.sendDefaultChannel = sendDefaultChannel;
