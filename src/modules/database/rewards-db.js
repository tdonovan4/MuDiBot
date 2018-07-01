var queries = require('./queries.js');

const insertQuery = 'INSERT OR IGNORE INTO reward (server_id, required_rank) VALUES (?,?)';

module.exports = {
  getRankReward: async function(serverId, rank) {
    var query = 'SELECT reward FROM reward WHERE server_id = ? AND required_rank = ?';
    var response = await queries.runGetQuery(query, [serverId, rank]);
    if (response != null) {
      response = response.reward;
    }
    return response;
  },
  updateRankReward: async function(serverId, rank, reward) {
    var updateQuery = 'UPDATE reward SET reward = ? WHERE server_id = ? AND required_rank = ?';
    var args = [serverId, rank];
    await queries.runInsertUpdateQuery(insertQuery, updateQuery, args, [reward]);
  },
  deleteRankReward: async function(serverId, rank) {
    var query = 'DELETE FROM reward WHERE server_id = ? AND required_rank = ?';
    await queries.runQuery(query, [serverId, rank]);
  }
}
