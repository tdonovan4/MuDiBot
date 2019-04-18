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
  //Periodic metrics
  module.exports.uniqueGuildTotal = new prom.Gauge({
    name: 'mudibot_unique_guild_total',
    help: 'Total number of unique guilds the bot is in currently'
  });
  module.exports.uniqueUserTotal = new prom.Gauge({
    name: 'mudibot_unique_user_total',
    help: 'Total number of unique users in the database'
  });
  module.exports.customCommandTotal = new prom.Gauge({
    name: 'mudibot_custom_command_total',
    help: 'Total number of custom commands in the database'
  });
  module.exports.birthdayTotal = new prom.Gauge({
    name: 'mudibot_birthday_total',
    help: 'Total number of birthdays in the database (including duplicates)'
  });
  module.exports.periodicMetricSeconds = new prom.Gauge({
    name: 'mudibot_periodic_metric_seconds',
    help: 'Time taken to update the periodic metrics'
  });
}
