const sql = require('sqlite');
const config = require('./args.js').getConfig()[1];

module.exports = {
  setChannel: async function(msg, channel) {
    try {
      await sql.open(config.pathDatabase);
    } catch (e) {
      console.error(e);
    }
    //Try to get server
    try {
      var row = await sql.get(`SELECT * FROM servers WHERE serverId = "${msg.guild.id}"`);
    } catch (e) {
      //Error while getting server
      try {
        await sql.run("CREATE TABLE IF NOT EXISTS servers (serverId TEXT, defaultChannel TEXT)");
        await sql.run("INSERT INTO servers (serverId, defaultChannel) VALUES (?, ?)", [msg.guild.id, channel.id]);
      } catch (e) {
        console.error(e);
      }
    }
    //Got row, trying to update server
    try {
      if (!row) {
        //Table exist but not row
        await sql.run("INSERT INTO servers (serverId, defaultChannel) VALUES (?, ?)", [msg.guild.id, channel.id]);
      } else {
        await sql.run("UPDATE servers SET defaultChannel = ? WHERE serverId = ?", [channel.id, msg.guild.id]);
      }
    } catch (e) {
      console.error(e);
    }
    await sql.close();
  },

  getChannel: async function(client, member) {
    await sql.open(config.pathDatabase)
    try {
      var row = await sql.get("SELECT * FROM servers WHERE serverId = ?", member.guild.id);
    } catch (error) {
      try {
        await sql.run("CREATE TABLE IF NOT EXISTS servers (serverId TEXT, defaultChannel TEXT)");
      } catch (error) {
        console.log(error);
      }
      sql.run("INSERT INTO servers (serverId, defaultChannel) VALUES (?, ?)", [member.guild.id, null]);
    }

    if (!row) {
      await sql.run("INSERT INTO servers (serverId, defaultChannel) VALUES (?, ?)", [member.guild.id, null]);
    } else if (row.defaultChannel != null) {
      if (client.channels.get(row.defaultChannel) != undefined) {
        sql.close();
        return client.channels.get(row.defaultChannel);
      }
    }

    //Get all text channels in server
    var channels = client.channels.filter(function(channel) {
      return channel.type == 'text' && channel.guild.id == member.guild.id;
    });

    var channel = channels.find('name', 'general');
    if (channel == null) {
      //General don't exist
      channel = channels.find('position', 0);
    }
    //Update
    sql.run("UPDATE servers SET defaultChannel = ? WHERE serverId = ?", [channel.id, member.guild.id])
    sql.close();

    return channel;
  }
}
