const sql = require('sqlite');
const config = require('./args.js').getConfig()[1];

module.exports = {
  setChannel: function(msg, channel) {
    return new Promise(function(resolve) {
      sql.open(config.pathDatabase).then(() => {
        sql.get(`SELECT * FROM servers WHERE serverId = "${msg.guild.id}"`).then(row => {
          if (!row) {
            //Table exist but not row
            sql.run("INSERT INTO servers (serverId, defaultChannel) VALUES (?, ?)", [msg.guild.id, channel.id]).then(() => {
              resolve()
            });
          } else {
            sql.run("UPDATE servers SET defaultChannel = ? WHERE serverId = ?", [channel.id, msg.guild.id]).then(() => {
              resolve()
            });
          }
        }).catch(() => {
          sql.run("CREATE TABLE IF NOT EXISTS servers (serverId TEXT, defaultChannel TEXT)").then(() => {
            //Table don't exist
            sql.run("INSERT INTO servers (serverId, defaultChannel) VALUES (?, ?)", [msg.guild.id, channel.id]);
          }).catch(error => {
            console.log(error);
          });
          resolve()
        });
        sql.close();
      }).catch(error => {
        console.log(error);
        resolve()
      });
    });
  },

  getChannel: async function(client, member) {
    await sql.open(config.pathDatabase)
    try {
      var row = await sql.get("SELECT * FROM servers WHERE serverId = ?", member.guild.id);
    }
    catch(error) {
      try {
        await sql.run("CREATE TABLE IF NOT EXISTS servers (serverId TEXT, defaultChannel TEXT)");
      }
      catch(error) {
        console.log(error);
      }
      sql.run("INSERT INTO servers (serverId, defaultChannel) VALUES (?, ?)", [member.guild.id, null]);
    }

    if (!row) {
      await sql.run("INSERT INTO servers (serverId, defaultChannel) VALUES (?, ?)", [member.guild.id, null]);
      sql.close();
    } else if(row.defaultChannel != null) {
      sql.close();
      if (client.channels.get(row.defaultChannel) != undefined) {
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
