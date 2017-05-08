//TODO: Put more comments
const Discord = require("discord.js");
const client = new Discord.Client();
const config = require('../config.js');
const data = require('./localization.json');
const warning = require('./warning.js');
const player = require('./audio-player.js');
var localization;

client.login(config.botID);

client.on('ready', () => {
	console.log(`Logged in as ${client.user.username}!`);
	if (config.language === 'french') {
		localization = data.french
			console.log('french');
	} else {
		localization = data.english
			console.log('english');
	}
	client.user.setGame(localization.status);
});

var commands = {
	ping: {
		permLvl: "everyone",
		execute: function (msg) {
			msg.reply(localization.replies.ping);
		}
	},
	gif: {
		permLvl: "roleMember",
		execute: function (msg) {
			msg.reply('http://giphy.com/gifs/l4FGBpKfVMG4qraJG');
		}
	},
	clearlog: {
		permLvl: "roleModo",
		execute: function (msg) {
			let args = msg.content.split(" ").slice(1);
			let num = args[0];

			if (num === null || isNaN(num)) {
				num = '50';
			}
			clear(msg, num);
		}
	},
	join: {
		permLvl: "roleMember",
		execute: function (msg) {
			player.play(1, msg);
		}
	},
	hello: {
		permLvl: "everyone",
		execute: function (msg) {
			player.play(2, msg);
			msg.reply(localization.replies.hello)
		}
	},
	quit: {
		permLvl: "everyone",
		execute: function (msg) {
			player.stop(msg);
		}
	},
	help: {
		permLvl: "everyone",
		execute: function (msg) {
			var help = localization.help;
			var roles = msg.channel.guild.roles;
			var helpString = '~Help~' + '\n'
				for (i = 0; i < help.length; i++) {
					for (n = 0; n < help[i].commands.length; n++) {
						helpString += help[i].commands[n].name + help[i].commands[n].args + ' : [' +
						mention(roles, commands[keys[i]].permLvl) + '] ' + help[i].commands[n].msg + '\n'
					}
				}
				msg.channel.send(helpString);
		}
	},
	restart: {
		permLvl: "roleModo",
		execute: function () {
			var spawn = require('child_process').spawn;

			var child = spawn('node', ['./src/bot.js'], {
					detached: true,
					shell: true,
					stdio: 'ignore'
				});
			
			child.unref();
			console.log('Restarting');

			process.exitCode = 0;
			process.exit();
		}
	},
	info: {
		permLvl: "everyone",
		execute: function (msg) {
			var pjson = require('../package.json');

			msg.channel.send('~Infos~ \n' +
				localization.info[0] + pjson.name + '\n' +
				localization.info[1] + pjson.version + '\n' +
				localization.info[2] + localization.replies.info + '\n' +
				localization.info[3] + pjson.author + '\n' +
				localization.info[4] + time() + '\n' +
				localization.info[5] + config.roleMember + '\n' +
				localization.info[6] + config.roleModo);
		}
	},
	tnt: {
		permLvl: "everyone",
		execute: function (msg) {
			msg.reply(localization.replies.tnt);
			player.play(3, msg);
		}
	},
	kill: {
		permLvl: "roleModo",
		execute: function (msg) {
			console.log('Restarting');
			process.exitCode = 0;
			process.exit();
		}
	},
	warn: {
		permLvl: "roleModo",
		execute: function (msg) {
			warning.warn(msg);
		}
	},
	play: {
		permLvl: "everyone",
		execute: function (msg) {
			player.playYoutube(msg, msg.content.split(" ").slice(1), config.youtubeAPIKey);
		}
	}
}

var keys = Object.keys(commands);

client.on('message', msg => {
	if (msg.author.id != "290581674343792651") {
		for (i = 0; i < keys.length; i++) {
			//We add a +1 because keys don't include the $
			if (msg.content.substring(0, keys[i].length + 1) === '$' + keys[i]) {
				console.log('$' + keys[i]);
				commands[keys[i]].execute(msg);
				break;
			}
		}
	}
});

function time() {
	var time = process.uptime();
	var days = ~~(time / 86400)
	var hrs = ~~((time % 86400) / 3600);
	var mins = ~~((time % 3600) / 60);
	var secs = ~~(time % 60);
	return days + 'd:' + hrs + 'h:' + mins + 'm:' + secs + 's'
}

var commandsToClear = config.commandsToClear;
var usersToClear = config.usersToClear;

function clear(msg, num) {
	msg.channel.fetchMessages({
		limit: parseInt(num)
	})
	.then(messages => {
		console.log(num)
		for (var i = 0; i < messages.array().length; i++) {
			if (messages.array()[i].author.id === client.user.id) {
				messages.array()[i].delete ()
			} else {
				clearLoops(messages.array()[i]);
			}
		}
		console.log('Messages cleared!');
	})
	.catch (console.error);
}

function clearLoops(messages) {
	for (var n = 0; n < keys.length; n++) {
		//We add a +1 because keys don't include the $
		if (messages.content.substring(0, keys[n].length + 1) == '$' + keys[n]) {
			messages.delete ()
			return;
		}
	}
	for (var n = 0; n < commandsToClear.length; n++) {
		if (messages.content.includes(commandsToClear[n])) {
			messages.delete ()
			return;
		}
	}
	for (var n = 0; n < usersToClear.length; n++) {
		if (messages.author.id === usersToClear[n]) {
			messages.delete ()
			return;
		}
	}
}

function mention(roles, role) {
	if (role === 'everyone') {
		return '@everyone';
	} else if (role === "roleMember") {
		return roles.find("name", config.roleMember);
	} else if (role === "roleModo") {
		return roles.find("name", config.roleModo);
	} else {
		return null;
	}
}
function checkRole(msg, role) {
	var permLevel = 0;
	var currentPermLevel = 0;

	if (msg.author.id === '265280961409843202') {
		return true;
	}
	var permissions = msg.member.permissions;
	if (permissions.hasPermission('ADMINISTRATOR') || permissions.hasPermission('MANAGE_CHANNELS')) {
		return true;
	}
	if (role === roleMember) {
		permLevel = 1;
	} else if (role === roleModo) {
		permLevel = 2;
	}
	for (i = 0; i < msg.member.roles.array().length; i++) {
		if (msg.member.roles.array()[i].name === config.roleModo) {
			currentPermLevel = 2;
			break;
		}
		if (msg.member.roles.array()[i].name === config.roleMember) {
			currentPermLevel = 1;
		}
	}
	if (currentPermLevel < permLevel) {
		console.log("Not enough permissions");
		return false;
	} else {
		return true;
	}
}

process.on('SIGINT', function () {
	process.exit(2);
});
