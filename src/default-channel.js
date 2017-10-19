let sql = require('sqlite');

module.exports = {
  setChannel: function(msg, channel) {
    sql.get(`SELECT * FROM servers WHERE serverId = "${msg.guild.id}"`).then(row => {
      if (!row) {
        //Table exist but not row
        sql.run("INSERT INTO servers (serverId, defaultChannel) VALUES (?, ?)", [msg.guild.id, channel.id]);
      } else {
        sql.run(`UPDATE servers SET defaultChannel = ${channel.id} WHERE serverId = ${msg.guild.id}`)
      }
    }).catch(() => {
      sql.run("CREATE TABLE IF NOT EXISTS servers (serverId TEXT, defaultChannel TEXT)").then(() => {
        //Table don't exist
        sql.run("INSERT INTO servers (serverId, defaultChannel) VALUES (?, ?)", [msg.guild.id, channel.id]);
      }).catch(error => {
        console.log(error);
      });
    });
  },

  getChannel: async function(client, member) {
    sql.open('./storage/data.db');

    var channel = await sql.get(`SELECT * FROM servers WHERE serverId = "${member.guild.id}"`).then(row => {
      if (!row) {
        sql.run("INSERT INTO servers (serverId, defaultChannel) VALUES (?, ?)", [member.guild.id, null]);
      } else {
        return row.defaultChannel;
      }
    }).catch(() => {
      sql.run("CREATE TABLE IF NOT EXISTS servers (serverId TEXT, defaultChannel TEXT)").then(() => {
        sql.run("INSERT INTO servers (serverId, defaultChannel) VALUES (?, ?)", [member.guild.id, null]);
      }).catch(error => {
        console.log(error);
      });
    });

    if(client.channels.get(channel) != undefined) {
      return client.channels.get(channel);
    }

    //Get all text channels in server
    var channels = client.channels.filter(function(channel) {
      return channel.type == 'text' && channel.guild == member.guild;
    });

    var channel = channels.find('name', 'general');
    if(channel == undefined) {
      //General don't exist
      channel = channels.find('position', 0);
    }
    //Update
    sql.run(`UPDATE servers SET defaultChannel = ${channel.id} WHERE serverId = ${member.guild.id}`)
    return channel;
  }
}
