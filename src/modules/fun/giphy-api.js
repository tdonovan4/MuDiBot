const bot = require('../../bot.js');
const https = require('https');
var config = require('../../args.js').getConfig()[1];

module.exports = {
  GifCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'gif',
        aliases: [],
        category: 'fun',
        permLvl: 1
      });
    }
    async execute(msg, args) {
      var url = await search(args);
      if (url != undefined) {
        msg.channel.send(url);
      }
    }
  },
  GifRandomCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'gifrandom',
        aliases: [],
        category: 'fun',
        permLvl: 1
      });
    }
    async execute(msg, args) {
      var url = await random(args);
      if (url != undefined) {
        msg.channel.send(url);
      }
    }
  }
}


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

function search(args) {
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
}

function random(args) {
  return new Promise((resolve) => {
    get(`https://api.giphy.com/v1/gifs/random?api_key=${config.giphyAPIKey}${args[0] == undefined ? '' : '&tag=' + args[0]}&limit=1&rating=g`)
      .then(function(response) {
        resolve(response.data.url)
      });
  });
}
