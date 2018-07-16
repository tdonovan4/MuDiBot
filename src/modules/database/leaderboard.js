var queries = require('./queries.js');

module.exports = {
  getLocalTop: async function(serverId, limit) {
    //Get top of this server using limit
    var query = 'SELECT user_id, xp FROM user WHERE server_id = ? ORDER BY xp DESC LIMIT ?';
    var response = await queries.runAllQuery(query, [serverId, limit]);
    return response;
  },
  getUserLocalPos: async function(serverId, userId) {
    //Get user position in the server leaderboard
    var query = 'SELECT user_id, xp FROM user WHERE server_id = ? ORDER BY xp DESC';
    var orderedTable = await queries.runAllQuery(query, [serverId]);
    //Plus 1 because indexOf is 0 indexed
    var position = orderedTable.map(user => user.user_id).indexOf(userId) + 1;
    //Find user position in the ordered table
    return position;
  },
  getGlobalTop: async function(limit) {
    //Get top of all users using limit
    var query = 'SELECT user_id, SUM(xp) FROM user GROUP BY user_id ORDER BY SUM(xp) DESC LIMIT ?';
    var response = await queries.runAllQuery(query, [limit]);
    //Change SUM(xp) to xp
    response = response.map(user => {
      user.xp = user['SUM(xp)'];
      delete user['SUM(xp)'];
      return user;
      });
    return response;
  },
  getUserGlobalPos: async function(userId) {
    //Get user position in the leaderboard
    var query = 'SELECT user_id, SUM(xp) FROM user GROUP BY user_id ORDER BY SUM(xp) DESC';
    var orderedTable = await queries.runAllQuery(query, []);
    //Plus 1 because indexOf is 0 indexed
    var position = orderedTable.map(user => user.user_id).indexOf(userId) + 1;
    //Find user position in the ordered table
    return position;
  }
}
