//Play requested audio when called
const ytdl = require('ytdl-core');
const https = require('https');
const bot = require('./bot.js');
const config = require('./args.js').getConfig();
const mustache = require('mustache');
var lang = require('./localization.js').getLocalization();
var queue = [];
var voiceConnection;

function joinChannel(message) {
  var channel = message.member.voiceChannel;
  if (typeof channel !== "undefined") {
    channel.join().then(connection => playVideo(connection, message));
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

function addToQueue(message, url) {
  if (url.indexOf('list=') !== -1) {
    //Url is a playlist
    var regExpPlaylist = new RegExp("list=([a-zA-Z0-9\-\_]+)&?", "i");
    var id = regExpPlaylist.exec(url);
    var api = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=' + id[1] + '&maxResults=50&key=' + config.youtubeAPIKey;

    get(api).then(function(response) {
      getPlaylistVideos(0, response, message);
    });
  } else {
    //Url is a video
    checkIfAvailable(url).then(values => {
      let text = (values != null) ? mustache.render(lang.play.added.video, {
        values
      }) : lang.play.unavailable;
      if (values != null) {
        queue.push(values);
      }
      bot.printMsg(message, text);
      if (message.member.voiceChannel.connection == null && queue.length != 0) {
        joinChannel(message);
      }
    });
  }
}

function getPlaylistVideos(i, response, message) {
  var promises = [];
  for (i = 0; i < response.items.length; i++) {
    var video = 'https://www.youtube.com/watch?v=' + response.items[i].snippet.resourceId.videoId
    promises[i] = checkIfAvailable(video).then(values => {
      return values;
    });
  }
  Promise.all(promises).then(values => {
    for (n = 0; n < values.length; n++) {
      if (values[n] != null) {
        queue.push(values[n]);
      }
    }
    bot.printMsg(message, lang.play.added.playlist);
    if (message.member.voiceChannel.connection == null && queue.length != 0) {
      joinChannel(message);
    }
  });
}

function checkIfAvailable(url) {
  return new Promise((resolve) => {
    var regex = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
    var id = url.match(regex);
    var api = 'https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=' + id + '&key=' + config.youtubeAPIKey;
    get(api).then(function(response) {
      if (false) {
        resolve(false);
      } else {
        ytdl.getInfo(url).then(info => {
          var duration = response.items[0].contentDetails.duration.match(/\d\d*\w/g).join(' ');
          resolve([url, info.title, duration.toLowerCase()]);
        }, function() {
          resolve(null);
        });
      }
    });
  });
}

//Play YouTube video (audio only)
function playVideo(connection, message) {
  voiceConnection = connection;
  bot.printMsg(message, mustache.render(lang.play.playing, {queue}));
  //Downloading
  var stream = ytdl(queue[0][0], {
    filter: 'audioonly'
  });
  dispatcher = connection.playStream(stream);

  dispatcher.on('end', () => {
    queue.splice(0, 1)
    if (queue.length > 0) {
      playVideo(connection, message)
    } else {
      connection.disconnect();
    }
  });
}
module.exports = {
  //Get YouTube video
  playYoutube: function(message, link) {
    var regex = /^(http(s)??\:\/\/)?(www\.)?((youtube\.com\/watch\?v=)|(youtu.be\/))([a-zA-Z0-9\-_])+/
    if (regex.test(link[0])) {
      //Direct link to video
      addToQueue(message, link[0]);
    } else {
      //Search the video with the YouTube API
      var video = 'https://www.googleapis.com/youtube/v3/search?part=snippet&q=[' + link + ']&maxResults=1&type=video&key=' + config.youtubeAPIKey;
      get(video).then(function(response) {
        var url = 'https://www.youtube.com/watch?v=' + response.items[0].id.videoId
        addToQueue(message, url);
      });
    }
  },
  //Stop playing the audio and leave channel
  stop: function(message) {
    if (voiceConnection != null) {
      voiceConnection.disconnect();
      queue = [];
      bot.printMsg(message, lang.play.disconnected);
    }
  },
  //Skip song
  skip: function(message) {
    //Ugly solution, but it's the only one
    try {
      var dispatcherStream = message.member.voiceChannel.connection.player.dispatcher.stream;
      dispatcherStream.destroy();
      bot.printMsg(message, lang.play.skipped);
    } catch (stream) {}
  },
  listQueue: function(message) {
    var list = lang.play.queue;
    //Get video titles
    for (i = 0; i < queue.length; i++) {
      list += '\n "' + queue[i][1] + '"';
    }
    //Write titles
    message.channel.send(list);
  }
}
