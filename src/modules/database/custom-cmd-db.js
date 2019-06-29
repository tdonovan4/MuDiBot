var queries = require('./queries.js');

module.exports = {
  getGlobalCount: async function() {
    var query = 'SELECT COUNT(name) FROM custom_command';
    var response = await queries.runGetQuery(query, []);
    return response['COUNT(name)'];
  },
  getCmd: async function(serverId, name) {
    var query = 'SELECT * FROM custom_command WHERE server_id = ? AND name = ?';
    return await queries.runGetQuery(query, [serverId, name]);
  },
  getCmds: async function(serverId) {
    var query = 'SELECT * FROM custom_command WHERE server_id = ?';
    return await queries.runAllQuery(query, serverId);
  },
  getUserCmds: async function(serverId, userId) {
    var query = 'SELECT * FROM custom_command WHERE server_id = ? AND author_id = ?';
    return await queries.runAllQuery(query, [serverId, userId]);
  },
  insertCmd: async function(serverId, userId, name, arg) {
    var query = 'INSERT INTO custom_command VALUES (?, ?, ?, ?)';
    await queries.runQuery(query, [serverId, userId, name, arg]);
  },
  deleteCmd: async function(serverId, name) {
    var query = 'DELETE FROM custom_command WHERE server_id = ? AND name = ?';
    await queries.runQuery(query, [serverId, name]);
  }
}
