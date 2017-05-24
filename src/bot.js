//Main class
const Discord = require("discord.js");
const client = new Discord.Client();
const config = require('../config.js');
const data = require('./localization.json');
const warning = require('./warning.js');
const player = require('./audio-player.js');
var localization;

//Log to the discord user  with the ID
client.login(config.botID);

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
			clear(msg, num);
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
			var help = localization.help;
			var roles = msg.channel.guild.roles;

			//Use a string to add all commands one by one
			var helpString = '~Help~' + '\n';
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
			console.log('Restarting');
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
				console.log('$' + keys[i]);
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

//List of commands to clear (excluding all this bot commands)
var commandsToClear = config.commandsToClear;
var usersToClear = config.usersToClear;

//Function that fetch, check and delete messages
function clear(msg, num) {
	//Fetch
	msg.channel.fetchMessages({
		limit: parseInt(num)
	})
	.then(messages => {
		console.log(num)
		//Check messages
		for (var i = 0; i < messages.array().length; i++) {
			//Find bot messages
			if (messages.array()[i].author.id === client.user.id) {
				messages.array()[i].delete ()
			} else {
				/*
				 *TODO: Optimize loops by using one list 
				 *	   with all needed to be deleted
				 */
				//Find bot commands
				for (var n = 0; n < keys.length; n++) {
					//We add a +1 because keys don't include the $
					if (messages.content.substring(0, keys[n].length + 1) == '$' + keys[n]) {
						messages.delete ()
						break
					}
				}
				/*
				 *The two next loops check for commands and 
				 *users to delete using the config file
				 */
				for (var n = 0; n < commandsToClear.length; n++) {
					if (messages.content.includes(commandsToClear[n])) {
						messages.delete ()
						break;
					}
				}
				for (var n = 0; n < usersToClear.length; n++) {
					if (messages.author.id === usersToClear[n]) {
						messages.delete ()
						break;
					}
				}
			}
		}
		console.log('Messages cleared!');
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
	
	//TODO: add a list of exceptions in config
	//Debug only, check if user is tdonovan4
	if (msg.author.id === '265280961409843202') {
		return true;
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

//Make sure the process exits correctly and don't fails to close
process.on('SIGINT', function () {
	process.exit(2);
});
