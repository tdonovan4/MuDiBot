const { Socket } = require('net');
const { EventEmitter } = require('events');
const util = require('../../util.js');
const config = util.getConfig()[1];
const port = config.metrics.exporterPort;
var lang = require('../../localization.js').getLocalization();
let prom;

let emitter = new EventEmitter();

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
      //Emit an event to init the rest
      emitter.emit('startMetrics', prom);
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
  return prom;
}

module.exports.init = init;
module.exports.emitter = emitter;
