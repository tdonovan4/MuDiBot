//Play requested audio when called
const ytdl = require('ytdl-core');
const https = require('https');
const bot = require('../../bot.js');
const config = require('../../args.js').getConfig()[1];
const mustache = require('mustache');
var lang = require('../../localization.js').getLocalization();
var guildQueues = new Map();

module.exports = {
  PlayCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'play',
        aliases: [],
        category: 'music',
        priority: 10,
        permLvl: 0
      });
    }
    execute(msg, args) {
      module.exports.playYoutube(msg, args);
    }
  },
  //Stop playing the audio and leave channel
  StopCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'stop',
        aliases: [],
        category: 'music',
        priority: 9,
        permLvl: 0
      });
    }
    execute(msg, args) {
      var guildQueue = getQueue(msg.guild.id);
      if (guildQueue.connection != undefined) {
        //Disconnect from channel
        guildQueue.connection.disconnect();
        //Reset
        guildQueue.connection = undefined;
        guildQueue.queue = [];
        bot.printMsg(msg, lang.play.disconnected);
      } else {
        //Not in a channel
        bot.printMsg(msg, lang.stop.notInVoiceChannel);
      }
    }
  },
  //Skip song
  SkipCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'skip',
        aliases: [],
        category: 'music',
        priority: 8,
        permLvl: 0
      });
    }
    execute(msg, args) {
      try {
        var dispatcherStream = msg.member.voiceChannel.connection.player.dispatcher.stream;
        dispatcherStream.destroy();
        bot.printMsg(msg, lang.play.skipped);
      } catch (stream) {}
    }
  },
  QueueCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'queue',
        aliases: [],
        category: 'music',
        priority: 7,
        permLvl: 0
      });
    }
    execute(msg, args) {
      var list = lang.play.queue;
      //Get video titles
      for (i = 0; i < queue.length; i++) {
        list += '\n "' + queue[i][1] + '"';
      }
      //Write titles
      msg.channel.send(list);
    }
  },
  //Get YouTube video
  playYoutube: async function(msg, args) {
    //Check if there is an arg
    if (args.length == 0) {
      //Missing argument;
      msg.channel.send(lang.error.usage);
      return;
    }
    //Check if user is an a channel
    if (msg.member.voiceChannel == null) {
      //Not in a channel
      bot.printMsg(msg, lang.error.notFound.voiceChannel);
      return;
    }
    var videoId;
    //Check if url to video
    if (ytdl.validateURL(args[0])) {
      //Direct link to video
      var videoId = ytdl.getURLVideoID(args[0]);
      //If case not valid
      if (videoId != null) {
        videoId = videoId;
      }
    } else {
      //Search the video with the YouTube API
      var response = await get('https://www.googleapis.com/youtube/v3/search?part=snippet' +
        `&q=${encodeURIComponent(args)}` +
        '&maxResults=1' +
        '&type=video' +
        `&key=${config.youtubeAPIKey}`);
      if (response.items != undefined && response.items.length > 0) {
        videoId = response.items[0].id.videoId;
      }
    }
    //Check if a video was found
    if (videoId != undefined) {
      getVideoInfo(msg, videoId);
    } else {
      //Error: no video found
      msg.channel.send(lang.error.notFound.video);
    }
  },
  downloadVideo: function(url, args) {
    //So that it can be stubbed
    return ytdl(url, args);
  }
}

class GuildQueue {
  constructor(id) {
    this.queue = []
    this.id = id;
    this.connection;
  }
  getVideos(number) {
    return this.queue.slice(0, number);
  }
  playQueue(msg) {
    var video = this.queue[0];
    var url = `https://youtu.be/${video.id}`;
    try {
      var stream = module.exports.downloadVideo(url, {
        filter: 'audioonly'
      });
    } catch (error) {
      //Error during video downloading
      console.log(error);
      msg.channel.send(lang.ytdlError);
    }

    var dispatcher = this.connection.playStream(stream);

    msg.channel.send(mustache.render(lang.play.playing, video));

    dispatcher.on('end', () => {
      //Remove played video
      this.queue.splice(0, 1);
      if (this.queue.length > 0) {
        //Playing the next song
        this.playQueue(msg);
      } else {
        this.connection.disconnect();
        //Remove connection
        this.connection = undefined;
      }
    });
  }
  async addToQueue(msg, video) {
    //Add video to queue
    this.queue.push(video);
    //Message if not first in queue
    if (this.queue.length > 1) {
      msg.channel.send(mustache.render(lang.play.added, video));
    }
    if (this.connection == undefined) {
      //No voiceConnection so join the channel and start playing the queue.
      this.connection = await msg.member.voiceChannel.join();
      this.playQueue(msg);
    }
  }
}

class Video {
  constructor(id, title, duration) {
    this.id = id;
    this.title = title;
    this.duration = duration.match(/\d\d*\w/g).join(' ').toLowerCase();
  }
}

function getQueue(id) {
  var queue = guildQueues.get(id);
  if (queue == null) {
    //Not defined, creating a queue
    guildQueues.set(id, new GuildQueue(id));
    queue = guildQueues.get(id);
  }
  return queue;
}

async function getVideoInfo(msg, videoId) {
  var response = await get('https://www.googleapis.com/youtube/v3/videos' +
    '?part=snippet,contentDetails' +
    `&id=${videoId}` +
    `&key=${config.youtubeAPIKey}`);
  if (response.items != undefined && response.items.length > 0) {
    var item = response.items[0]
    var video = new Video(item.id, item.snippet.title, item.contentDetails.duration);
    //Add the video to the guild queue
    getQueue(msg.guild.id).addToQueue(msg, video);
  } else {
    msg.channel.send(lang.play.unavailable);
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
      console.log(e.msg);
    });
  });
}
