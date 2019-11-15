const config = require('../../util.js').getConfig()[1];
var queries = require('./queries.js');

const insertQuery = 'INSERT OR IGNORE INTO user (server_id, user_id) VALUES (?, ?)'

module.exports = {
  exists: async function(serverId, userId) {
    var query = 'SELECT 1 FROM user WHERE server_id = ? AND user_id = ? LIMIT 1';
    var response = await queries.runGetQuery(query, [serverId, userId]);
    return response != undefined;
  },
  getLocalCount: async function(serverId) {
    var query = 'SELECT COUNT(user_id) FROM user WHERE server_id = ?';
    var response = await queries.runGetQuery(query, [serverId]);
    return response['COUNT(user_id)'];
  },
  getGlobalCount: async function() {
    var query = 'SELECT COUNT(DISTINCT user_id) FROM user';
    var response = await queries.runGetQuery(query, []);
    return response['COUNT(DISTINCT user_id)'];
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
  getHighestPermGroup: async function(serverId, userId) {
    //In util.js and not in permission-group.js to prevent circular dependency
    let userGroups = await module.exports.getPermGroups(serverId, userId);
    let userGroupName;
    if (userGroups != null && userGroups != 'empty') {
      userGroupName = userGroups.split(',').sort(function(a, b) {
        return config.groups.find(x => x.name == b).permLvl -
          config.groups.find(x => x.name == a).permLvl;
      })[0];
    } else {
      //Default if no group
      userGroupName = config.groups[0].name;
    }
    let userGroup = config.groups.find(x => x.name == userGroupName);
    return userGroup;
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
  getSumXP: async function(userId) {
    var query = 'SELECT SUM(xp) FROM user GROUP BY user_id HAVING user_id = ?';
    var response = await queries.runGetQuery(query, [userId]);
    if (response == null || response['SUM(xp)'] == null) {
      response = {};
      response['SUM(xp)'] = 0;
    }
    return response['SUM(xp)'];
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
  getUsersWarnings: async function(serverId) {
    var query = 'SELECT user_id, warning FROM user WHERE server_id = ?';
    return await queries.runAllQuery(query, serverId);
  },
  getUsersByBirthday: async function(date) {
    var query = 'SELECT * FROM user WHERE SUBSTR(birthday, -5) = ?';
    var response = await queries.runAllQuery(query, [date]);
    return response;
  },
  getGlobalBirthdayCount: async function() {
    var query = 'SELECT COUNT(birthday) FROM user WHERE birthday != "Unknown"';
    var response = await queries.runGetQuery(query, []);
    return response['COUNT(birthday)'];
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
  updateBio: async function(serverId, userId, newBio) {
    //Update user's profile bio
    var updateQuery = 'UPDATE user SET bio = ? WHERE server_id = ? AND user_id = ?';
    var args = [serverId, userId];
    await queries.runInsertUpdateQuery(insertQuery, updateQuery, args, [newBio]);
  },
  updateBirthday: async function(serverId, userId, newBirthday) {
    //Update user's profile birthday
    var updateQuery = 'UPDATE user SET birthday = ? WHERE server_id = ? AND user_id = ?';
    var args = [serverId, userId];
    await queries.runInsertUpdateQuery(insertQuery, updateQuery, args, [newBirthday]);
  },
  updateLocation: async function(serverId, userId, newLocation) {
    //Update user's profile location
    var updateQuery = 'UPDATE user SET location = ? WHERE server_id = ? AND user_id = ?';
    var args = [serverId, userId];
    await queries.runInsertUpdateQuery(insertQuery, updateQuery, args, [newLocation]);
  },
  updateUsersWarnings: async function(serverId, newWarnings) {
    var query = 'UPDATE user SET warning = ? WHERE server_id = ?';
    await queries.runUpdateQuery(query, serverId, newWarnings);
  }
}
