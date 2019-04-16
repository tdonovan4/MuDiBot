const exporter = require('./exporter.js')

module.exports.init = async function() {
  let prom = await exporter.init();

  //Custom metrics
  module.exports.startupTimeSeconds = new prom.Gauge({
    name: 'mudibot_startup_time_seconds',
    help: 'Time taken to start the bot in seconds'
  });
  module.exports.commandExecutedTotal = new prom.Counter({
    name: 'mudibot_command_executed_total',
    help: 'Total number of commands executed',
    labelNames: ['command']
  });
  module.exports.commandExecutionSeconds = new prom.Gauge({
    name: 'mudibot_command_execution_seconds',
    help: 'Execution time of a command in seconds',
    labelNames: ['command']
  });
  module.exports.customCommandExecutedTotal = new prom.Counter({
    name: 'mudibot_custom_command_executed_total',
    help: 'Total number of custom commands executed'
  });
  module.exports.dbQueryTotal = new prom.Counter({
    name: 'mudibot_db_query_total',
    help: 'Total number of query executed',
    labelNames: ['type']
  });
  module.exports.dbQueryExecutionSeconds = new prom.Gauge({
    name: 'mudibot_db_query_execution_seconds',
    help: 'Execution time of a query in seconds',
    labelNames: ['type']
  });
  module.exports.dbQueryErrorTotal = new prom.Counter({
    name: 'mudibot_db_query_error_total',
    help: 'Total number of query errors',
    labelNames: ['type']
  });
}
