const https = require('https');
var config = require('../config.js');

function get(url) {
  return new Promise(function(resolve) {
    https.get(url, (res) => {
      var body = '';
      res.on("data", function(chunk) {
        body += chunk;
      });
      res.on('end', function() {
        resolve(JSON.parse(body));
      });
    }).on('error', function(e) {
      console.log(e.message);
    });
  });
}

module.exports = {
  search: function(args) {
    //Search on giphy for a GIF and output URL
    return new Promise((resolve) => {
      var url;
      if (args[0] != undefined) {
        //Search
        url = `https://api.giphy.com/v1/gifs/search?api_key=${config.giphyAPIKey}&q=${args[0]}&limit=1`;
      } else {
        //Get a trending GIF
        url = `https://api.giphy.com/v1/gifs/trending?api_key=${config.giphyAPIKey}&limit=1`;
      }
      get(url).then(function(response) {
        //Return the url
        resolve(response.data[0].url);
      });
    });
  },
  random: function(args) {
    return new Promise((resolve) => {
      get(`https://api.giphy.com/v1/gifs/random?api_key=${config.giphyAPIKey}${args[0] == undefined ? '' : '&tag=' + args[0]}&limit=1&rating=g`)
        .then(function(response) {
          console.log(response);
          resolve(response.data.url)
        });
    });
  }
}
