const ytdl = require('ytdl-core');
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
	playStream: function (message, link) {
		var channel = message.member.voiceChannel;
		if (typeof channel !== "undefined") {
			channel.join()
			.then(connection => {
				const stream = ytdl(link, {filter : 'audioonly'});
				dispatcher = connection.playStream(stream);
				dispatcher.on('end', () => connection.disconnect());
			})
		}
	},
	stop: function (message) {
		var channel = message.member.voiceChannel;
		if (typeof channel !== "undefined" && channel.connection != null) {
			channel.connection.disconnect();
		}
	}
}
