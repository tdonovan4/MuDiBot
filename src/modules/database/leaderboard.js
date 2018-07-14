var queries = require('./queries.js');

module.exports = {
  getLocalTop: async function(serverId, limit) {
    //Get top of this server using limit
    var query = 'SELECT user_id, xp FROM user WHERE server_id = ? ORDER BY xp DESC LIMIT ?';
    var response = await queries.runAllQuery(query, [serverId, limit]);
    return response;
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
  }
}
