const sql = require('sqlite');
const config = require('../../util.js').getConfig()[1];
const metrics = require('../../modules/metrics/metrics.js');

module.exports = {
  runQuery: async function(query, args) {
    let start = Date.now()
    try {
      await sql.open(config.pathDatabase);
      await sql.run(query, args);
      await sql.close();
    } catch (e) {
      console.error(e);
      //Log metrics if error
      metrics.dbQueryErrorTotal.inc({ type: 'run' });
    }
    let elapsed = Date.now() - start;
    //Log metrics
    metrics.dbQueryTotal.inc({ type: 'run' });
    metrics.dbQueryExecutionSeconds.set({ type: 'run' }, elapsed / 1000);
  },
  runGetQuery: async function(query, args) {
    let start = Date.now()
    try {
      await sql.open(config.pathDatabase);
      var response = await sql.get(query, args);
      await sql.close();
    } catch (e) {
      console.error(e);
      //Log metrics if error
      metrics.dbQueryErrorTotal.inc({ type: 'get' });
    }
    let elapsed = Date.now() - start;
    //Log metrics
    metrics.dbQueryTotal.inc({ type: 'get' });
    metrics.dbQueryExecutionSeconds.set({ type: 'get' }, elapsed / 1000);
    return response;
  },
  runAllQuery: async function(query, args) {
    let start = Date.now()
    try {
      await sql.open(config.pathDatabase);
      var response = await sql.all(query, args);
      await sql.close();
    } catch (e) {
      console.error(e);
      //Log metrics if error
      metrics.dbQueryTotal.inc({ type: 'all' });
      metrics.dbQueryErrorTotal.inc({ type: 'all' });
    }
    let elapsed = Date.now() - start;
    //Log metrics
    metrics.dbQueryExecutionSeconds.set({ type: 'all' }, elapsed / 1000);
    return response;
  },
  runInsertUpdateQuery: async function(insertQuery, updateQuery, args, newValues) {
    let start = Date.now()
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
      //Log metrics if error
      metrics.dbQueryErrorTotal.inc({ type: 'insert/update' });
    }
    let elapsed = Date.now() - start;
    //Log metrics
    metrics.dbQueryTotal.inc({ type: 'insert/update' });
    metrics.dbQueryExecutionSeconds.set({ type: 'insert/update' }, elapsed / 1000);
  },
  runUpdateQuery: async function(query, userId, newValue) {
    let start = Date.now()
    try {
      await sql.open(config.pathDatabase);
      //Update user
      await sql.run(query, [newValue, userId]);
      await sql.close();
    } catch (e) {
      console.error(e);
      //Log metrics if error
      metrics.dbQueryErrorTotal.inc({ type: 'update' });
    }
    let elapsed = Date.now() - start;
    //Log metrics
    metrics.dbQueryTotal.inc({ type: 'update' });
    metrics.dbQueryExecutionSeconds.set({ type: 'update' }, elapsed / 1000);
  }
}
