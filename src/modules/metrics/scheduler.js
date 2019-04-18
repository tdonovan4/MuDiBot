const schedule = require('node-schedule');
const Discord = require('discord.js');
const db = require('../database/database.js');
const metrics = require('./metrics.js');
const exporter = require('./exporter.js');

//Using events to prevent circular dependencies
exporter.emitter.on('startMetrics', () => {
  async function collect() {
    console.log('test')
    let start = Date.now();
    //Get the number of guilds using the API
    metrics.uniqueGuildTotal.set(Discord.client.guilds.size);
    //Get number of users by counting the total number of unique users in db
    metrics.uniqueUserTotal.set(await db.user.getGlobalCount());
    //Get total number of custom commands in db
    metrics.customCommandTotal.set(await db.customCmd.getGlobalCount());
    //Get total number of birthdays in db (including duplicates)
    metrics.customCommandTotal.set(await db.user.getGlobalBirthdayCount());
    let elapsed = Date.now() - start;
    metrics.periodicMetricSeconds.set(elapsed / 1000);
  }
  //Execute every 10 minutes
  schedule.scheduleJob('*/10 * * * *', collect);
  //Execute one time
  collect();
});
