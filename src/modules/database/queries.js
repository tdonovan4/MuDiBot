const sql = require('sqlite');
const config = require('../../util.js').getConfig()[1];
const metrics = require('../../modules/metrics/metrics.js');

let queriesRunning = 0

async function openDb() {
  //Only open db if closed
  if (!sql.driver.open) {
    await sql.open(config.pathDatabase);
  }
  queriesRunning++;
}

async function closeDb() {
  //Only close db is open and there is no more queries running
  queriesRunning--;
  if (sql.driver.open && queriesRunning == 0) {
    await sql.close();
  }
}

module.exports = {
  runQuery: async function(query, args) {
    let start = Date.now()
    try {
      await openDb()
      await sql.run(query, args);
      await closeDb();
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
      await openDb()
      var response = await sql.get(query, args);
      await closeDb();
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
      await openDb()
      var response = await sql.all(query, args);
      await closeDb();
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
      await openDb()
      //If user don't exist, insert
      await sql.run(insertQuery, args);
      if (newValues != undefined) {
        //Add the new values at the beginning of the args
        args = newValues.concat(args);
      }
      //Update user
      await sql.run(updateQuery, args);
      await closeDb();
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
      await openDb()
      //Update user
      await sql.run(query, [newValue, userId]);
      await closeDb();
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
