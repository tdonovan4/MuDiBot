const config = require('../../args.js').getConfig()[1];
var queries = require('./queries.js');

module.exports = {
  user: {
    exists: async function(serverId, userId) {
      var query = 'SELECT 1 FROM users WHERE serverId = ? AND userId = ? LIMIT 1';
      var response = await queries.runGetQuery(query, [serverId, userId]);
      return response != undefined;
    },
    getAll: async function(serverId, userId) {
      var query = 'SELECT * FROM users WHERE serverId = ? AND userId = ?';
      var user = await queries.runGetQuery(query, [serverId, userId]);
      return user;
    },
    getPermGroups: async function(serverId, userId) {
      var query = 'SELECT groups FROM users WHERE serverId = ? AND userId = ?';
      var response = await queries.runGetQuery(query, [serverId, userId]);
      //Add default group
      if (response == null || response.groups == null) {
        response = {};
        response.groups = config.groups[0].name;
        //Update db
        await this.updatePermGroups(serverId, userId, response.groups);
      }
      return response.groups;
    },
    getXP: async function(serverId, userId) {
      var query = 'SELECT xp FROM users WHERE serverId = ? AND userId = ?';
      var response = await queries.runGetQuery(query, [serverId, userId]);
      if (response == null || response.xp == null) {
        response = {};
        response.xp = 0;
      }
      return response.xp;
    },
    getWarnings: async function(serverId, userId) {
      var query = 'SELECT warnings FROM users WHERE serverId = ? AND userId = ?';
      var response = await queries.runGetQuery(query, [serverId, userId]);
      if (response == null || response.warnings == null) {
        response = {};
        response.warnings = 0;
      }
      return response.warnings;
    },
    updatePermGroups: async function(serverId, userId, groups) {
      //Update user's permission groups
      var query = 'UPDATE users SET groups = (?) WHERE serverId = ? AND userId = ?';
      await queries.runUpdateQueryUser(query, serverId, userId, groups);
    },
    updateXP: async function(serverId, userId, newXP) {
      //Update user's xp
      var query = 'UPDATE users SET xp = ? WHERE serverId = ? AND userId = ?';
      await queries.runUpdateQueryUser(query, serverId, userId, newXP);
    },
    updateWarnings: async function(serverId, userId, newWarnings) {
      //Update user's warnings
      var query = 'UPDATE users SET warnings = ? WHERE serverId = ? AND userId = ?';
      await queries.runUpdateQueryUser(query, serverId, userId, newWarnings);
    }
  },
  getWarnings: async function(serverId) {
    var query = 'SELECT userId, warnings FROM users WHERE serverId = ?';
    return await queries.runAllQuery(query, serverId);
  },
  updateWarnings: async function(serverId, newWarnings) {
    var query = 'UPDATE users SET warnings = ? WHERE serverId = ?';
    await queries.runUpdateQueryUsers(query, serverId, newWarnings);
  }
}
