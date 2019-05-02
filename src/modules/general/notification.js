const schedule = require('node-schedule');
const db = require('../database/database.js');
const mustache = require('mustache');
const { client } = require('discord.js');
const { toDbDate } = require('../../util.js');
const metrics = require('../metrics/metrics.js');
var lang = require('../../localization.js').getLocalization();

async function sendDefaultChannel(guild, text) {
  let channel = await db.config.getDefaultChannel(guild);
  channel.send(text);
}

async function printBirthdaysForDate(date, birthdayMessages) {
  //Local time, format: mm-dd
  var formatedDate = (date.getMonth() + 1).toString().padStart(2, '0') + '-' +
    date.getDate().toString().padStart(2, '0');
  //Special case for the bot's anniversary
  if (formatedDate === '04-06') {
    /*
     * This is a different message from the birthdays messages
     * that is send to all servers the bot is in.
     */
    let message = mustache.render(birthdayMessages.botBirthday, {
      age: date.getFullYear() - 2017
    })
    //Send to all servers
    for (let guild of client.guilds.keys()) {
      await sendDefaultChannel(guild, message);
      //Log to metrics
      metrics.birthdaySentTotal.inc();
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
      message = mustache.render(birthdayMessages.one, {
        mention: birthdayUsers[0],
        time: `${date.getFullYear()}-${formatedDate}`
      });
    } else {
      //If multiple birthdays
      message = mustache.render(birthdayMessages.multiple, {
        users: birthdayUsers.join(', '),
        time: `${date.getFullYear()}-${formatedDate}`
      });
    }
    await sendDefaultChannel(guildId, message);
    //Log to metrics
    metrics.birthdaySentTotal.inc();
  }
}

//Execute everyday at 12:00, send notif about birthdays
let birthdays = schedule.scheduleJob('0 12 * * *', async function() {
  //A day in ms
  const oneDay = (24 * 60 * 60 * 1000);
  let currentDate = new Date();
  let lastCheck = await db.botGlobal.getLastBirthdayCheck();

  if (lastCheck == null) {
    //First time using the birthday notification system, starting from today
    await printBirthdaysForDate(currentDate, lang.general.birthdays);
  } else {
    let lastCheckDate = new Date(lastCheck);
    let startDate = lastCheckDate.getTime() + oneDay;
    let tommorow = currentDate.getTime() + oneDay;
    //Iterate through days since last check
    for (let date = startDate; date < tommorow; date += oneDay) {
      //Check if date is before today
      if (date < currentDate.getTime()) {
        //The birthdays were missed
        //Change messages to reflect that the birthdays were missed
        await printBirthdaysForDate(new Date(date), lang.general.birthdays.missed);
      } else {
        //The birthdays weren't missed
        await printBirthdaysForDate(new Date(date), lang.general.birthdays);
      }
    }
  }
  await db.botGlobal.updateLastBirthdayCheck(toDbDate(currentDate));
});

module.exports.birthdays = birthdays;
module.exports.sendDefaultChannel = sendDefaultChannel;
