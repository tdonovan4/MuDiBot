const ytdl = require('ytdl-core');
const https = require('https');
var queue = [];
var voiceConnection;
function playVideo(message) {
	var channel = message.member.voiceChannel;
	if (typeof channel !== "undefined") {
		channel.join()
		.then(connection => {
			voiceConnection = true;
			dispatcher = connection.playStream(queue[0]);
			dispatcher.on('end', () => {
				connection.disconnect
				queue.splice(0, 1)
				if (queue.length > 0) {
					playVideo(message)
				} else {
					connection.disconnect();
				}
			});
		})
	}
}
module.exports = {
	currentVoice: null,
	play: function (i, message) {
		var emoji = message.guild.emojis.find('name', 'tnt');
		if (emoji === null) {
			emoji = '';
		}
		var channel = message.member.voiceChannel;

		if (typeof channel !== "undefined") {
			if (i === 1) {
				channel.join()
				.then(connection => {
					dispatcher = connection.playFile('./sound/sound.mp3');
					dispatcher.on('end', () => connection.disconnect());
				})
				.catch (console.error);
			}
			if (i === 2) {
				channel.join()
				.then(connection => {
					dispatcher = connection.playFile('./sound/hello.wav');
					dispatcher.on('end', () => connection.disconnect());
				})
				.catch (console.error);
			}
			if (i === 3) {
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
		} else if (i === 3) {
			message.reply('Boom! ' + emoji);
		}
	},
	playYoutube: function (message, link, key) {
		var regex = /(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/;
		console.log(link);
		if (regex.test(link) && link.includes('www.youtube.com')) {
			queue.push(ytdl(link, {
					filter: 'audioonly'
				}));
			//TODO: Put in only one location
			if (message.member.voiceChannel.connection == null) {
				playVideo(message);
			}
		} else {

			var video = 'https://www.googleapis.com/youtube/v3/search?part=snippet&q=[' + link + ']&maxResults=1&key=' + key;
			https.get(video, (res) => {
				var body = '';
				res.on("data", function (chunk) {
					body += chunk;
				});

				res.on('end', function () {
					response = JSON.parse(body);
					console.log(response.items[0].id.videoId);
					queue.push(ytdl('https://www.youtube.com/watch?v=' + response.items[0].id.videoId, {
							filter: 'audioonly'
						}));
					console.log(queue.length);
					if (message.member.voiceChannel.connection == null) {
						playVideo(message);
					}
				});
			}).on('error', function (e) {
				console.log("Got error: " + e.message);
			});
		}
	},
	stop: function (message) {
		var channel = message.member.voiceChannel;
		if (typeof channel !== "undefined" && channel.connection != null) {
			channel.connection.disconnect();
		}
	}
}
