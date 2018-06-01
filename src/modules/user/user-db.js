const sql = require('sqlite');
const config = require('../../args.js').getConfig()[1];

async function runGetQuery(query, args) {
  await sql.open(config.pathDatabase);
  var response = await sql.get(query, args);
  await sql.close();
  return response;
}

module.exports = {
  user: {
    getPermGroups: async function(serverId, userId) {
      var query = 'SELECT userId,groups FROM users WHERE serverId = ? AND userId = ?';
      var response = await runGetQuery(query, [serverId, userId]);
      //Since groups can be null, check if user exists (temporary)
      if(response.userId != null && response.groups == null) {
        response.groups = 'empty';
      }
            console.log(response);
      return response.groups;
    },
    getXp: async function(serverId, userId) {
      var query = 'SELECT xp FROM users WHERE serverId = ? AND userId = ?';
      var xp = (await runGetQuery(query, [serverId, userId])).xp;
      return xp;
    }
  }
}
