//Play requested audio when called
const ytdl = require('ytdl-core');
const https = require('https');
const bot = require('./bot.js');
var queue = [];
var voiceConnection;

function joinChannel(message) {
	var channel = message.member.voiceChannel;
	if (typeof channel !== "undefined") {
		channel.join().then(connection => playVideo(connection, message));
	}
}

//Play YouTube video (audio only)
function playVideo(connection, message) {
	voiceConnection = true;
	ytdl.getInfo(queue[0]).then(info => {
		bot.printMsg(message, 'Playing: "' + info.title + '"');
	});
	//Downloading
	var stream = ytdl(queue[0], {
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
	currentVoice: null,
	//Sound effects
	play: function (sound, message) {
		var emoji = message.guild.emojis.find('name', 'tnt');
		if (emoji === null) {
			emoji = '';
		}
		var channel = message.member.voiceChannel;

		if (typeof channel !== "undefined") {
			if (sound === 'hello') {
				channel.join()
				.then(connection => {
					dispatcher = connection.playFile('./sound/hello.wav');
					dispatcher.on('end', () => connection.disconnect());
				})
				.catch (console.error);
			}
			if (sound === 'tnt') {
				channel.join()
				.then(connection => {
					dispatcher = connection.playFile('./sound/explosion.wav');
					dispatcher.on('end', () => {
						connection.disconnect();
						message.reply('Boom! ' + emoji);
					});
				})
				.catch (console.error);
			}
			currentVoice = channel;
		} else if (sound === 'tnt') {
			message.reply('Boom! ' + emoji);
		}
	},
	//Get YouTube video
	playYoutube: function (message, link, key) {
		var regex = /^(http(s)??\:\/\/)?(www\.)?((youtube\.com\/watch\?v=)|(youtu.be\/))([a-zA-Z0-9\-_])+/
		if (regex.test(link[0])) {
			//Direct link to video
			ytdl.getInfo(link[0]).then(function(info) {
				queue.push(link[0]);
				bot.printMsg(message, '"' + info.title + '" added to the queue');

				if (message.member.voiceChannel.connection == null) {
					joinChannel(message);
				}
			}, function() {
				bot.printMsg(message, 'Invalid video url!');
			});
		} else {
			//Search the video with the YouTube API
			var video = 'https://www.googleapis.com/youtube/v3/search?part=snippet&q=[' + link + ']&maxResults=1&type=video&key=' + key;
			https.get(video, (res) => {
				var body = '';
				res.on("data", function (chunk) {
					body += chunk;
				});
				res.on('end', function () {
					response = JSON.parse(body);
					var url = 'https://www.youtube.com/watch?v=' + response.items[0].id.videoId
					queue.push(url);
					ytdl.getInfo(url).then(info => {
						bot.printMsg(message, '"' + info.title + '" added to the queue');
					});

					if (message.member.voiceChannel.connection == null) {
						joinChannel(message);
					}
				});
			}).on('error', function (e) {
				console.log("Got error: " + e.message);
			});
		}
	},
	//Stop playing the audio and leave channel
	stop: function (message) {
		var channel = message.member.voiceChannel;
		if (typeof channel !== "undefined" && channel.connection != null) {
			channel.connection.disconnect();
			queue = [];
			bot.printMsg(message, 'Disconnected!');
		}
	},
	//Skip song
	skip: function (message) {
		//Ugly solution, but it's the only one
		try {
			var dispatcherStream = message.member.voiceChannel.connection.player.dispatcher.stream;
			dispatcherStream.destroy();
			bot.printMsg(message, 'Song skipped!');
		} catch(stream){}
	},
	listQueue: function(message) {
		var promises = [];
		var titles = '**List of videos in queue:**';
		//Get video titles
		for(i = 0; i < queue.length; i++) {
			promises[i] = ytdl.getInfo(queue[i]).then(info => {
				return info.title;
			});
		}
		//Make list
		Promise.all(promises).then(values => {
			for(n = 0; n < values.length; n++) {
				titles += '\n "' + values[n] + '"';
			}
			//Write titles
			bot.printMsg(message, titles);
		});
	}
}
