const schedule = require('node-schedule');
const db = require('../database/database.js');
const mustache = require('mustache');
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
  var users = await db.user.getUsersByBirthday(formatedDate);
  //Group users by server
  var groupedUsers = new Map();
  for (var user of users) {
    if (!groupedUsers.has(user.server_id)) {
      groupedUsers.set(user.server_id, []);
    }
    groupedUsers.get(user.server_id).push(`<@${user.user_id}>`);
  }
  //Send a message in each server
  for (var guild of groupedUsers.keys()) {
    var message;
    var guildMembers = groupedUsers.get(guild);
    if (guildMembers.length === 1) {
      //If only one birthday
      message = mustache.render(lang.general.member.birthday, {
        mention: guildMembers[0]
      });
    } else {
      //If multiple birthdays
      message = mustache.render(lang.general.birthdays, {
        users: guildMembers.join(', ')
      });
    }
    await sendDefaultChannel(guild, message);
  }
});

module.exports.birthdays = birthdays;
module.exports.sendDefaultChannel = sendDefaultChannel;
