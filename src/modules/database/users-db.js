const config = require('../../args.js').getConfig()[1];
var queries = require('./queries.js');

const insertQuery = 'INSERT OR IGNORE INTO user (server_id, user_id) VALUES (?, ?)'

module.exports = {
  exists: async function(serverId, userId) {
    var query = 'SELECT 1 FROM user WHERE server_id = ? AND user_id = ? LIMIT 1';
    var response = await queries.runGetQuery(query, [serverId, userId]);
    return response != undefined;
  },
  getAll: async function(serverId, userId) {
    var query = 'SELECT * FROM user WHERE server_id = ? AND user_id = ?';
    var user = await queries.runGetQuery(query, [serverId, userId]);
    return user;
  },
  getPermGroups: async function(serverId, userId) {
    var query = 'SELECT permission_group FROM user WHERE server_id = ? AND user_id = ?';
    var response = await queries.runGetQuery(query, [serverId, userId]);
    //Check if response undefined
    if (response == undefined) {
      //Return default group
      response = config.groups[0].name;
      //Add default group to user so that it doesn't happen again
      await this.updatePermGroups(serverId, userId, response);
    } else {
      response = response.permission_group;
    }
    return response;
  },
  getXP: async function(serverId, userId) {
    var query = 'SELECT xp FROM user WHERE server_id = ? AND user_id = ?';
    var response = await queries.runGetQuery(query, [serverId, userId]);
    if (response == null || response.xp == null) {
      response = {};
      response.xp = 0;
    }
    return response.xp;
  },
  getWarnings: async function(serverId, userId) {
    var query = 'SELECT warning FROM user WHERE server_id = ? AND user_id = ?';
    var response = await queries.runGetQuery(query, [serverId, userId]);
    if (response == null || response.warning == null) {
      response = {};
      response.warning = 0;
    }
    return response.warning;
  },
  updatePermGroups: async function(serverId, userId, groups) {
    //Update user's permission groups
    var updateQuery = 'UPDATE user SET permission_group = (?) WHERE server_id = ? AND user_id = ?';
    var args = [serverId, userId];
    await queries.runInsertUpdateQuery(insertQuery, updateQuery, args, [groups]);
  },
  updateXP: async function(serverId, userId, newXP) {
    //Update user's xp
    var updateQuery = 'UPDATE user SET xp = ? WHERE server_id = ? AND user_id = ?';
    var args = [serverId, userId];
    await queries.runInsertUpdateQuery(insertQuery, updateQuery, args, [newXP]);
  },
  updateWarnings: async function(serverId, userId, newWarnings) {
    //Update user's warnings
    var updateQuery = 'UPDATE user SET warning = ? WHERE server_id = ? AND user_id = ?';
    var args = [serverId, userId];
    await queries.runInsertUpdateQuery(insertQuery, updateQuery, args, [newWarnings]);
  },
  getUsersWarnings: async function(serverId) {
    var query = 'SELECT user_id, warning FROM user WHERE server_id = ?';
    return await queries.runAllQuery(query, serverId);
  },
  updateUsersWarnings: async function(serverId, newWarnings) {
    var query = 'UPDATE user SET warning = ? WHERE server_id = ?';
    await queries.runUpdateQuery(query, serverId, newWarnings);
  }
}
