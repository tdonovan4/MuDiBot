const sql = require('sqlite');
const config = require('../../args.js').getConfig()[1];

module.exports = {
  runGetQuery: async function(query, args) {
    try {
      await sql.open(config.pathDatabase);
      var response = await sql.get(query, args);
      await sql.close();
    } catch (e) {
      console.error(e);
      return;
    }
    return response;
  },
  runAllQuery: async function(query, args) {
    try {
      await sql.open(config.pathDatabase);
      var response = await sql.all(query, args);
      await sql.close();
    } catch (e) {
      console.error(e);
      return;
    }
    return response;
  },
  runInsertUpdateQuery: async function(insertQuery, updateQuery, args, newValue) {
    try {
      await sql.open(config.pathDatabase);
      //If user don't exist, insert
      await sql.run(insertQuery, args);
      //Add the new value at the beginning of the args
      args.unshift(newValue);
      //Update user
      await sql.run(updateQuery, args);
      await sql.close();
    } catch (e) {
      console.error(e);
    }
  },
  runUpdateQuery: async function(query, userId, newValue) {
    try {
      await sql.open(config.pathDatabase);
      //Update user
      await sql.run(query, [newValue, userId]);
      await sql.close();
    } catch (e) {
      console.error(e);
    }
  }
}
