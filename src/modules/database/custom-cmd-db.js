var queries = require('./queries.js');

module.exports = {
  getCmd: async function(serverId, name) {
    var query = 'SELECT * FROM custom_command WHERE server_id = ? AND name = ?';
    return await queries.runGetQuery(query, [serverId, name]);
  },
  getCmds: async function(serverId) {
    var query = 'SELECT * FROM custom_command WHERE server_id = ?';
    return await queries.runAllQuery(query, serverId);
  },
  insertCmd: async function(serverId, userId, name, action, arg) {
    var query = 'INSERT INTO custom_command VALUES (?, ?, ?, ?, ?)';
    await queries.runQuery(query, [serverId, userId, name, action, arg]);
  },
  deleteCmd: async function(serverId, name) {
    var query = 'DELETE FROM custom_command WHERE server_id = ? AND name = ?';
    await queries.runQuery(query, [serverId, name]);
  }
}
