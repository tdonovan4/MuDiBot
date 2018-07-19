const { Command } = require('../../commands.js');
const https = require('https');
var config = require('../../util.js').getConfig()[1];

module.exports = {
  GifCommand: class extends Command {
    constructor() {
      super({
        name: 'gif',
        aliases: [],
        category: 'fun',
        priority: 10,
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
  GifRandomCommand: class extends Command {
    constructor() {
      super({
        name: 'gifrandom',
        aliases: ['gifr'],
        category: 'fun',
        priority: 9,
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

async function search(args) {
  //Search on giphy for a GIF and output URL
  var url;
  if (args[0] != undefined) {
    //Search
    url = `https://api.giphy.com/v1/gifs/search?api_key=${config.giphyAPIKey}&q=${args[0]}&limit=1`;
  } else {
    //Get a trending GIF
    url = `https://api.giphy.com/v1/gifs/trending?api_key=${config.giphyAPIKey}&limit=1`;
  }
  var response = await get(url);
  //Return the GIF url
  return response.data[0].url;
}

async function random(args) {
  var response = await get('https://api.giphy.com/v1/gifs/random?api_key=' +
    `${config.giphyAPIKey}${args[0] == undefined ? '' : '&tag=' + args[0]}&limit=1&rating=g`);
  //Return the random GIF url
  return response.data.url;
}
