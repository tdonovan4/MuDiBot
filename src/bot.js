//Main class
const Discord = require("discord.js");
const client = new Discord.Client();
const config = require('../config.js');
const data = require('./localization.json');
const warning = require('./warning.js');
const player = require('./audio-player.js');
var localization;

//Log to the discord user  with the token
client.login(config.botToken);

//Start the bot
client.on('ready', () => {
	console.log(`Logged in as ${client.user.username}!`);

	if (config.language === 'french') {
		localization = data.french
			console.log('french');
	} else {
		//Use english by default in case the chosen language is not found
		localization = data.english
			console.log('english');
	}

	client.user.setGame(localization.status);
});

module.exports.printMsg = function (msg, text) {
	console.log(text);
	msg.channel.send(text);
}

/*
 *Use an object containing command objects to get
 *the permission needed and execute the command
 */
var commands = {
	ping: {
		//Reply "Pong!"
		permLvl: "everyone",
		execute: function (msg) {
			msg.reply(localization.replies.ping);
			console.log("Pong!");
		}
	},
	gif: {
		//A GIF of a robot, just a funny little feature
		permLvl: "roleMember",
		execute: function (msg) {
			msg.reply('http://giphy.com/gifs/l4FGBpKfVMG4qraJG');
		}
	},
	clearlog: {
		//Clear listed commands
		permLvl: "roleModo",
		execute: function (msg) {
			//Split the message to get only the argument
			let args = msg.content.split(" ").slice(1);
			let numToDel = args[0];

			//In case the argument isn't a valid number
			if (numToDel === null || isNaN(numToDel)) {
				numToDel = '50';
			}
			clear(msg, numToDel);
		}
	},
	hello: {
		//Play a greeting sound and reply hi
		permLvl: "everyone",
		execute: function (msg) {
			player.play('hello', msg);
			msg.reply(localization.replies.hello);
		}
	},
	quit: {
		//Stop the voice connection and leave voice channel
		permLvl: "everyone",
		execute: function (msg) {
			player.stop(msg);
		}
	},
	help: {
		//Display a list of commands and their usage
		permLvl: "everyone",
		execute: function (msg) {
			const help = localization.help;
			let args = msg.content.split(" ").slice(1);
			var categories = {
				General: ['ping', 'help', 'info'],
				Fun: ['gif', 'hello', 'tnt'],
				Music: ['play', 'quit', 'skip', 'queue'],
				Administration: ['clearlog', 'restart', 'kill', 'warn']
			};

			if (args[0] != null) {
				/*
				 *Check if args is a category and
				 *put first letter of args in uppercase
				 */
				if (args[0][0].toUpperCase() + args[0].substring(1)in categories) {
					args[0] = args[0][0].toUpperCase() + args[0].substring(1);
					var category = categories[args[0]];
					for (var member in categories)
						delete categories[member];
					//Add only desired category
					categories[args[0]] = category;
					//Check if args is a command
				} else if (args[0]in help) {
					for (var member in categories)
						delete categories[member];
					categories.helpSingleCmd = [args[0]];
				}
			}

			helpList(msg, categories);
		}
	},
	restart: {
		//Restart the client
		permLvl: "roleModo",
		execute: function () {
			//Spawn new process
			var spawn = require('child_process').spawn;

			var child = spawn('node', ['./src/bot.js'], {
					detached: true,
					shell: true,
					stdio: 'ignore'
				});
			child.unref();

			console.log('Restarting');

			//Exit this process
			process.exitCode = 0;
			process.exit();
		}
	},
	info: {
		//Display info about the client
		permLvl: "everyone",
		execute: function (msg) {
			var pjson = require('../package.json');

			msg.channel.send('__**~Infos~**__ \n' +
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
		//Play a big boom!
		permLvl: "everyone",
		execute: function (msg) {
			msg.reply(localization.replies.tnt);
			player.play('tnt', msg);
		}
	},
	kill: {
		//Kill the process
		permLvl: "roleModo",
		execute: function (msg) {
			console.log('Shutting down...');
			process.exitCode = 0;
			process.exit();
		}
	},
	warn: {
		//Handle warnings
		permLvl: "roleModo",
		execute: function (msg) {
			warning.warn(msg);
		}
	},
	play: {
		//Play a song on YouTube
		permLvl: "everyone",
		execute: function (msg) {
			player.playYoutube(msg, msg.content.split(" ").slice(1), config.youtubeAPIKey);
		}
	},
	skip: {
		//Skip to next song in queue
		permLvl: "roleMember",
		execute: function (msg) {
			player.skip(msg);
		}
	},
	queue: {
		//Skip to next song in queue
		permLvl: "everyone",
		execute: function (msg) {
			player.listQueue(msg);
		}
	}
}

var keys = Object.keys(commands);

/*
 *Function fired when a message is posted
 *to check if the message is calling a command
 */
client.on('message', msg => {
	if (msg.author.id != "290581674343792651") {
		for (i = 0; i < keys.length; i++) {
			//We add a +1 because keys don't include the $
			if (msg.content.substring(0, keys[i].length + 1) === '$' + keys[i]) {
				console.log(msg.author.username + ' - ' + msg.content);
				commands[keys[i]].execute(msg);
				break;
			}
		}
	}
});

//Format time
function time() {
	var time = process.uptime();
	var days = ~~(time / 86400)
	var hrs = ~~((time % 86400) / 3600);
	var mins = ~~((time % 3600) / 60);
	var secs = ~~(time % 60);
	return days + 'd:' + hrs + 'h:' + mins + 'm:' + secs + 's'
}

//Create the message
function helpList(msg, categories) {
	const help = localization.help;
	var roles = msg.channel.guild.roles;

	var helpString = '__**~Help~**__' + '\n';
	for (var prop in categories) {
		//Check if only one command
		helpString += '\n'
		if (prop != 'helpSingleCmd') {
			helpString += '**-' + prop + '**\n';
		}
		var category = categories[prop];
		for (listCmd = 0; listCmd < Object.keys(category).length; listCmd++) {
			if (help.hasOwnProperty(category[listCmd])) {
				for (n = 0; n < help[category[listCmd]].length; n++) {
					helpString += help[category[listCmd]][n].name + help[category[listCmd]][n].args + ' : [' +
					mention(roles, commands[category[listCmd]].permLvl) + '] ' + help[category[listCmd]][n].msg + '\n'
				}
			}
		}
	}
	msg.channel.send(helpString);
}

//Function that fetch, check and delete messages
function clear(msg, num) {
	var clearList = config.commandsToClear.concat(config.usersToClear);
	for (i = 0; i < keys.length; i++) {
		clearList.push('$' + keys[i]);
	}

	//Fetch
	msg.channel.fetchMessages({
		limit: parseInt(num)
	})
	.then(messages => {
		console.log("Max messages to delete: " + num);
		var msg = messages.array();
		var deletedMessages = 0;

		//Check messages
		for (var i = 0; i < messages.array().length; i++) {
			//Delete commands from bot
			if (msg[i].author.id === client.user.id) {
				msg[i].delete ()
				deletedMessages++;
			} else {
				//Find and delete
				for (var n = 0; n < clearList.length; n++) {
					if (msg[i].content.substring(0, clearList[n].length) === clearList[n] || msg[i].author.id === clearList[n]) {
						msg[i].delete ()
						deletedMessages++;
						break
					}
				}
			}
		}
		console.log(deletedMessages + ' messages deleted!');
	})
	.catch (console.error);
}

//Convert roles into mention objects
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
/*
 *Check if the message author has permission
 *to do the command, return true or false
 */
function checkRole(msg, role) {
	var permLevel = 0;
	var currentPermLevel = 0;

	//Debug only, check if user is superuser
	for (i = 0; i < config.superusers.length; i++) {
		if (msg.author.id === config.superusers[i]) {
			return true;
		}
	}

	//Check if user is an administrator
	var permissions = msg.member.permissions;
	if (permissions.hasPermission('ADMINISTRATOR') || permissions.hasPermission('MANAGE_CHANNELS')) {
		return true;
	}

	//Set the required level of permission
	if (role === roleMember) {
		permLevel = 1;
	} else if (role === roleModo) {
		permLevel = 2;
	}

	//Set the user permission level
	for (i = 0; i < msg.member.roles.array().length; i++) {
		if (msg.member.roles.array()[i].name === config.roleModo) {
			currentPermLevel = 2;
			break;
		}
		if (msg.member.roles.array()[i].name === config.roleMember) {
			currentPermLevel = 1;
		}
	}

	//Compare user and needed permission level
	if (currentPermLevel < permLevel) {
		console.log("Not enough permissions");
		return false;
	} else {
		return true;
	}
}

//When users join the server
client.on('guildMemberAdd', member => {
	member.guild.defaultChannel.send(`Welcome to the server, ${member}!`);
});

//When users leave the server
client.on('guildMemberRemove', member => {
	member.guild.defaultChannel.send(`${member} left the server :slight_frown:`);
});

//Make sure the process exits correctly and don't fails to close
process.on('SIGINT', function () {
	process.exit(2);
});
