const http = require('http');
const client = require('prom-client');
const register = client.register;
const collectDefaultMetrics = client.collectDefaultMetrics;
//TODO: add to config
const port = 4444;

collectDefaultMetrics();

function getStarterPage(req, res) {
  res.write('<h1>Mudibot metrics exporter</h1> <a href="metrics">Metrics');
  res.end();
}

function getMetrics(req, res) {
  res.write('Content-Type', register.contentType);
  res.end(register.metrics());
}

//Error message if page doesn't exist
function noResponse(req, res) {
  res.writeHead(404);
  res.write('Sorry, but this page doesn\'t exit...');
  res.end();
}

http.createServer((req, res) => {
  //Route to correct page
  const router = {
    'GET/': getStarterPage,
    'GET/metrics': getMetrics,
    'default': noResponse
  };

  //Parse url
  let reqUrl = new URL(req.url, 'http://127.0.0.1/');

  //Execute correct function based on url
  let redirectedFunc = router[req.method + reqUrl.pathname] || router.default;

  redirectedFunc(req, res, reqUrl);
}).listen(port, () => {
  console.log(`Listening for prometheus on ${port}`);
});
