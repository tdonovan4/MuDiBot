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
    getPermLvl: async function(serverId, userId) {
      var query = 'SELECT groups FROM users WHERE serverId = ? AND userId = ?';
      var permLvl = (await runGetQuery(query, [serverId, userId])).groups;
      return permLvl;
    },
  }
}
