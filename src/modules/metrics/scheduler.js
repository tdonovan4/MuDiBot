const schedule = require('node-schedule');
const Discord = require('discord.js');
const { EventEmitter } = require('events');
const db = require('../database/database.js');
const metrics = require('./metrics.js');
const exporter = require('./exporter.js');

let emitter = new EventEmitter();
//Using events to prevent circular dependencies
exporter.emitter.on('startMetrics', () => {
  async function collect() {
    emitter.emit('startCollection');
    let start = Date.now();
    //Get the number of guilds using the API
    metrics.uniqueGuildTotal.set(Discord.client.guilds.size);
    //Get number of users by counting the total number of unique users in db
    metrics.uniqueUserTotal.set(await db.user.getGlobalCount());
    //Get total number of custom commands in db
    metrics.customCommandTotal.set(await db.customCmd.getGlobalCount());
    //Get total number of birthdays in db (including duplicates)
    metrics.birthdayTotal.set(await db.user.getGlobalBirthdayCount());
    let elapsed = Date.now() - start;
    metrics.periodicMetricSeconds.set(elapsed / 1000);
    emitter.emit('endCollection');
  }
  //Execute every 10 minutes
  module.exports.collection = schedule.scheduleJob('*/10 * * * *', collect);
  //Execute one time
  collect();
});
module.exports.emitter = emitter;
