const sql = require('sqlite');
const config = require('../../args.js').getConfig()[1];

async function runGetQuery(query, args) {
  await sql.open(config.pathDatabase);
  var response = await sql.get(query, args);
  await sql.close();
  return response;
}

async function runAllQuery(query, args) {
  await sql.open(config.pathDatabase);
  var response = await sql.all(query, args);
  await sql.close();
  return response;
}

module.exports = {
  user: {
    exists: async function(serverId, userId) {
      var query = 'SELECT 1 FROM users WHERE serverId = ? AND userId = ? LIMIT 1';
      var result = await runGetQuery(query, [serverId, userId]);
      return result != undefined;
    },
    getAll: async function(serverId, userId) {
      var query = 'SELECT * FROM users WHERE serverId = ? AND userId = ?';
      var user = await runGetQuery(query, [serverId, userId]);
      return user;
    },
    getPermGroups: async function(serverId, userId) {
      var query = 'SELECT userId,groups FROM users WHERE serverId = ? AND userId = ?';
      var response = await runGetQuery(query, [serverId, userId]);
      //Since groups can be null, check if user exists (temporary)
      if(response.userId != null && response.groups == null) {
        response.groups = 'empty';
      }
      return response.groups;
    },
    getXp: async function(serverId, userId) {
      var query = 'SELECT xp FROM users WHERE serverId = ? AND userId = ?';
      var response = await runGetQuery(query, [serverId, userId]);
      if(response != undefined) {
        response = response.xp;
      }
      return response;
    },
    getWarnings: async function(serverId, userId) {
      var query = 'SELECT warnings FROM users WHERE serverId = ? AND userId = ?';
      var response = await runGetQuery(query, [serverId, userId]);
      if(response != undefined) {
        response = response.warnings;
      }
      return response;
    }
  },
  users: {
    getWarnings: async function(serverId) {
      var query = 'SELECT userId, warnings FROM users WHERE serverId = ?';
      return await runAllQuery(query, serverId);
    }
  }
}
