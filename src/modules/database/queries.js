const sql = require('sqlite');
const config = require('../../args.js').getConfig()[1];
const checkTable = 'CREATE TABLE IF NOT EXISTS users (serverId TEXT, userId TEXT,' +
  `xp INTEGER DEFAULT 0, warnings INTEGER DEFAULT 0, groups TEXT DEFAULT "${config.groups[0].name}",` +
  'CONSTRAINT users_unique UNIQUE (serverId, userId))';

module.exports = {
  runGetQuery: async function(query, args) {
    try {
      await sql.open(config.pathDatabase);
      //Make sure table exists
      await sql.run(checkTable);
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
      //Make sure table exists
      await sql.run(checkTable);
      var response = await sql.all(query, args);
      await sql.close();
    } catch (e) {
      console.error(e);
      return;
    }
    return response;
  },
  runUpdateQueryUser: async function(query, serverId, userId, newValue) {
    try {
      await sql.open(config.pathDatabase);
      //Make sure table exists
      await sql.run(checkTable);
      //If user don't exist, insert
      await sql.run(`INSERT OR IGNORE INTO users (serverId, userId) VALUES (?, ?)`, [
        serverId, userId
      ]);
      //Update user
      await sql.run(query, [newValue, serverId, userId]);
      await sql.close();
    } catch (e) {
      console.error(e);
    }
  },
  runUpdateQueryUsers: async function(query, userId, newValue) {
    try {
      await sql.open(config.pathDatabase);
      //Make sure table exists
      await sql.run(checkTable);
      //Update user
      await sql.run(query, [newValue, userId]);
      await sql.close();
    } catch (e) {
      console.error(e);
    }
  }
}
