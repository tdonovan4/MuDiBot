const queries = require('./queries.js');
const mustache = require('mustache');
const lang = require('../../localization.js').getLocalization();
const { client } = require('discord.js');
var config = require('../../util.js').getConfig()[1];

const insertQuery = 'INSERT OR IGNORE INTO config (server_id) VALUES (?)';

function getBackupChannel(serverId) {
  var channel;
  //Get all text channels in server
  var channels = client.channels.filter(function(channel) {
    return channel.type == 'text' && channel.guild.id == serverId;
  });
  //If there is a channel named general, use it
  channel = channels.find(x => x.name === 'general');
  if (channel == null) {
    //General don't exist, using first channel
    channel = channels.find(x => x.position === 0);
  }
  return channel;
}

module.exports = {
  getDefaultChannel: async function(serverId) {
    var query = 'SELECT default_channel FROM config WHERE server_id = ?';
    var response = await queries.runGetQuery(query, serverId);
    var channel;
    if (response == null || response.default_channel == null) {
      //No channel in database, using backup
      channel = getBackupChannel(serverId);
    } else {
      //Channel found, checking
      channel = client.channels.get(response.default_channel);
      if (channel == undefined) {
        //This channel don't exists
        channel = getBackupChannel(serverId);
        channel.send(mustache.render(lang.error.notFound.defaultChannel, config));
      }
    }
    return channel;
  },
  updateDefaultChannel: async function(serverId, channel) {
    var updateQuery = 'UPDATE config SET default_channel = ? WHERE server_id = ?';
    await queries.runInsertUpdateQuery(insertQuery, updateQuery, [serverId], [channel.id]);
  }
}
