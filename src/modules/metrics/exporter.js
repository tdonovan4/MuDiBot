const { Socket } = require('net');
const util = require('../../util.js');
const config = util.getConfig()[1];
const port = config.metrics.exporterPort;
var lang = require('../../localization.js').getLocalization();
let prom;

function checkIfPortClosed(port) {
  let socket = new Socket()
  return new Promise(function(resolve) {
    socket.once('connect', function() {
      //In use
      socket.destroy();
      console.log(lang.error.portOpen);
      resolve(false);
    });
    socket.once('error', function() {
      //Not listening
      resolve(true);
    });
    socket.connect(port, '127.0.0.1');
  });
}

async function init() {
  //Check if metrics are activated
  if (config.metrics.activated && await checkIfPortClosed(port)) {
    //Setup for prometheus client
    prom = require('prom-client');
    const register = prom.register;
    const collectDefaultMetrics = prom.collectDefaultMetrics;

    //Register the default metrics
    collectDefaultMetrics();

    //Setup for web server
    const http = require('http');

    http.createServer((req, res) => {
      //Route to correct page
      const router = {
        'GET/': function(req, res) {
          res.write('<h1>Mudibot metrics exporter</h1> <a href="metrics">Metrics');
          res.end();
        },
        'GET/metrics': function(req, res) {
          res.write(register.metrics());
          res.end();
        },
        //Error message if page doesn't exist
        'default': function(req, res) {
          res.writeHead(404);
          res.write('Sorry, but this page doesn\'t exit...');
          res.end();
        }
      };

      //Parse url
      let reqUrl = new URL(req.url, 'http://127.0.0.1/');

      //Execute correct function based on url
      let redirectedFunc = router[req.method + reqUrl.pathname] || router.default;

      redirectedFunc(req, res, reqUrl);
    }).listen(port, () => {
      console.log(`Listening for prometheus on ${port}`);
    });
  } else {
    //Create a fake pom object
    prom = {
      Gauge: class {
        set() {
          return;
        }
        inc() {
          return;
        }
        dec() {
          return;
        }
      },
      Counter: class {
        inc() {
          return;
        }
      }
    }
  }

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

module.exports.init = init;
