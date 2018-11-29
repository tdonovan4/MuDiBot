const sql = require('sqlite');
const config = require('../../util.js').getConfig()[1];

module.exports = {
  runQuery: async function(query, args) {
    try {
      await sql.open(config.pathDatabase);
      await sql.run(query, args);
      await sql.close();
    } catch (e) {
      console.error(e);
      return;
    }
  },
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
  runInsertUpdateQuery: async function(insertQuery, updateQuery, args, newValues) {
    try {
      await sql.open(config.pathDatabase);
      //If user don't exist, insert
      await sql.run(insertQuery, args);
      if (newValues != undefined) {
        //Add the new values at the beginning of the args
        args = newValues.concat(args);
      }
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
