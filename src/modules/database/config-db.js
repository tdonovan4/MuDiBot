var queries = require('./queries.js');
var bot = require('../../bot.js');
var client = bot.client();

const insertQuery = 'INSERT OR IGNORE INTO servers (serverId) VALUES (?)';

function getBackupChannel(serverId) {
  var channel;
  //Get all text channels in server
  var channels = client.channels.filter(function(channel) {
    return channel.type == 'text' && channel.guild.id == serverId;
  });
  //If there is a channel named general, use it
  channel = channels.find('name', 'general');
  if (channel == null) {
    //General don't exist, using first channel
    channel = channels.find('position', 0);
  }
  return channel;
}

module.exports = {
  getDefaultChannel: async function(serverId) {
    var query = 'SELECT defaultChannel FROM servers WHERE serverId = ?';
    var response = await queries.runGetQuery(query, serverId);
    var channel;
    if(response == null || response.defaultChannel == null) {
      //No channel in database, using backup
      channel = getBackupChannel(serverId);
    } else  {
      //Channel found, checking
      channel = client.channels.get(response.defaultChannel);
      if (channel == undefined) {
        //This channel don't exists
        //TODO: error message
        channel = getBackupChannel(serverId);
      }
    }
    return channel;
  },
  updateDefaultChannel: async function(serverId, channel) {
    var updateQuery = 'UPDATE servers SET defaultChannel = ? WHERE serverId = ?';
    await queries.runInsertUpdateQuery(insertQuery, updateQuery, [serverId], [channel.id]);
  }
}
