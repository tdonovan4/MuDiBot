//TODO: Put more comments
const Discord = require("discord.js");
const client = new Discord.Client();
const config = require('../config.js');
const data = require('./command-data.json');
const warning = require('./warning.js');
const player = require('./audio-player.js');
var localization;

client.login(config.botID);

client.on('ready', () => {
	console.log(`Logged in as ${client.user.username}!`);
	if (config.language === 'french') {
		localization = data.localization.french
			console.log('french');
	} else {
		localization = data.localization.english
			console.log('english');
	}
	client.user.setGame(localization.status);
});

client.on('message', msg => {
	if (msg.author.id != "290581674343792651") {
		if (msg.content === data.commands[0] && checkRole(msg, data.perm[0])) {
			msg.reply(localization.botReply[0]);
			console.log(data.commands[0]);
		} else if (msg.content === data.commands[1] && checkRole(msg, data.perm[1])) {
			msg.reply('http://giphy.com/gifs/l4FGBpKfVMG4qraJG');
			console.log(data.commands[1]);
		} else if (msg.content.includes(data.commands[2]) && checkRole(msg, data.perm[2])) {
			let args = msg.content.split(" ").slice(1);
			let num = args[0];

			if (num === null || isNaN(num)) {
				num = '50';
			}
			clear(msg, num);
			console.log(data.commands[2]);
		} else if (msg.content === data.commands[3] && checkRole(msg, data.perm[3])) {
			player.play(1, msg);
			console.log(data.commands[3]);
		} else if (msg.content === data.commands[4] && checkRole(msg, data.perm[4])) {
			player.play(2, msg);
			msg.reply(localization.botReply[1])
			console.log(data.commands[4]);
		} else if (msg.content === data.commands[5] && checkRole(msg, data.perm[5])) {
			player.stop(msg);
			console.log(data.commands[5]);
		} else if (msg.content === data.commands[6] && checkRole(msg, data.perm[6])) {
			var roles = msg.channel.guild.roles;
			var helpString = '~Help~' + '\n'
				for (i = 0; i < data.localization.commands.length; i++) {
					helpString += data.localization.commands[i] + localization.helpArg[i] + ' : [' +
					mention(roles, data.perm[i]) + '] ' + localization.helpMsg[i] + '\n'
				}
				msg.channel.send(helpString);
			console.log(data.commands[6]);
		} else if (msg.content === data.commands[7] && checkRole(msg, data.perm[7])) {

			var spawn = require('child_process').spawn;

			var child = spawn('node', ['bot.js'], {
					detached: true,
					shell: true,
					stdio: 'ignore'
				});

			child.unref();

			console.log('Restarting');

			console.log(data.commands[7]);
			process.exitCode = 0;
			process.exit();
		} else if (msg.content === data.commands[8] && checkRole(msg, data.perm[8])) {
			var pjson = require('../package.json');

			msg.channel.send('~Infos~ \n' +
				localization.info[0] + pjson.name + '\n' +
				localization.info[1] + pjson.version + '\n' +
				localization.info[2] + localization.botReply[2] + '\n' +
				localization.info[3] + pjson.author + '\n' +
				localization.info[4] + time() + '\n' +
				localization.info[5] + config.roleMember + '\n' +
				localization.info[6] + config.roleModo);

			console.log(data.commands[8]);
		} else if (msg.content === data.commands[9] && checkRole(msg, data.perm[9])) {
			msg.reply(localization.botReply[3]);
			player.play(3, msg);
			console.log(data.commands[9]);
		} else if (msg.content === data.commands[10] && checkRole(msg, data.perm[10])) {
			console.log(data.commands[10]);
			process.exitCode = 0;
			process.exit();
		} else if (msg.content.includes(data.commands[11]) && checkRole(msg, data.perm[11])) {
			warning.warn(msg);
			console.log(data.commands[11]);
		} else if (msg.content.includes(data.commands[12]) && checkRole(msg, data.perm[12])) {
			player.playYoutube(msg, msg.content.split(" ").slice(1)[0]);
			console.log(data.commands[12]);
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
	for (var n = 0; n < data.commands.length; n++) {
		if (messages.content.substring(0, data.commands[n].length) == data.commands[n]) {
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
