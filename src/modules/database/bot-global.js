const queries = require('./queries.js');

module.exports = {
  getLastBirthdayCheck: async function() {
    let query = 'SELECT last_birthday_check FROM bot_global';
    let response = await queries.runGetQuery(query);
    if (response != undefined) {
      response = response.last_birthday_check;
    }
    return response;
  },
  updateLastBirthdayCheck: async function(time) {
    let insertQuery = 'INSERT OR IGNORE INTO bot_global (last_birthday_check) VALUES (?)';
    let updateQuery = 'UPDATE bot_global SET last_birthday_check = ?';
    await queries.runInsertUpdateQuery(insertQuery, updateQuery, [time]);
  }
}
