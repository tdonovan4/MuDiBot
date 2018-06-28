var queries = require('./queries.js');

const insertQuery = 'INSERT OR IGNORE INTO rewards (serverId, rank) VALUES (?,?)';

module.exports = {
  getRankReward: async function(serverId, rank) {
    var query = 'SELECT reward FROM rewards WHERE serverId = ? AND rank = ?';
    var response = await queries.runGetQuery(query, [serverId, rank]);
    if (response != null) {
      response = response.reward;
    }
    return response;
  },
  updateRankReward: async function(serverId, rank, reward) {
    var updateQuery = 'UPDATE rewards SET reward = ? WHERE serverId = ? AND rank = ?';
    var args = [serverId, rank];
    await queries.runInsertUpdateQuery(insertQuery, updateQuery, args, [reward]);
  },
  deleteRankReward: async function(serverId, rank) {
    var query = 'DELETE FROM rewards WHERE serverId = ? AND rank = ?';
    await queries.runQuery(query, [serverId, rank]);
  }
}
