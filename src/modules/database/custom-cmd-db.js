var queries = require('./queries.js');

module.exports = {
  getCmd: async function(serverId, name) {
    var query = 'SELECT * FROM customCmds WHERE serverId = ? AND name = ?';
    return await queries.runGetQuery(query, [serverId, name]);
  },
  getCmds: async function(serverId) {
    var query = 'SELECT * FROM customCmds WHERE serverId = ?';
    return await queries.runAllQuery(query, serverId);
  },
  insertCmd: async function(serverId, userId, name, action, arg) {
    var query = 'INSERT INTO customCmds VALUES (?, ?, ?, ?, ?)';
    await queries.runQuery(query, [serverId, userId, name, action, arg]);
  },
  deleteCmd: async function(serverId, name) {
    var query = 'DELETE FROM customCmds WHERE serverId = ? AND name = ?';
    await queries.runQuery(query, [serverId, name]);
  }
}
