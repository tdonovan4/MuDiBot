//Main class
const Discord = require("discord.js");
const client = new Discord.Client();
const config = require('../config.js');
const data = require('./localization.json');
const warning = require('./warning.js');
const player = require('./audio-player.js');
const levels = require('./levels.js');
const fs = require('fs');
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

	//setGame() doesn't work anymore, will be fixed in new discord.js version
	client.user.setPresence({ game: { name: config.status, type: 0 } });
});

module.exports.printMsg = function (msg, text) {
	printMsg(msg, text);
}

function printMsg(msg, text) {
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
	stop: {
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
				General: ['ping', 'help', 'info', 'status', 'say'],
				User: ['avatar', 'profile'],
				Fun: ['gif', 'hello', 'tnt', 'flipcoin', 'roll'],
				Music: ['play', 'stop', 'skip', 'queue'],
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
			localization.info[0] + '\n' +
			localization.info[1] + pjson.name + '\n' +
			localization.info[2] + pjson.version + '\n' +
			localization.info[3] + localization.replies.info + '\n' +
			localization.info[4] + pjson.author + '\n' +
			localization.info[5] + client.user.id + '\n' +
			localization.info[6] + time() + '\n' +
			localization.info[7] + '\n' +
			localization.info[8] + config.language + '\n' +
			localization.info[9] + config.roleMember + '\n' +
			localization.info[10] + config.roleModo);
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
			player.playYoutube(msg, msg.content.split(" ").slice(1));
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
	},
	flipcoin: {
		//Flip a coin
		permLvl: "everyone",
		execute: function (msg) {
			msg.reply(Math.floor(Math.random() * 2) == 0 ? 'heads' : 'tails');		}
		},
		roll: {
			//Flip a coin
			permLvl: "everyone",
			execute: function (msg) {
				args = msg.content.split(/[ d+]|(?=-)/g).slice(1);
				num = isNaN(args[2]) ? 0 : parseInt(args[2]);
				for(i = 0; i < args[0]; i++) {
					num += Math.floor(Math.random() * args[1])+1;
				}
				msg.reply(num);
			}
		},
		status: {
			permLvl: "roleModo",
			execute: function (msg) {
				var newStatus = msg.content.split("$status ").slice(1);
				client.user.setPresence({ game: { name: newStatus[0], type: 0 } });
				modifyText('./config.js', 'status: \'' + config.status, 'status: \'' + newStatus[0]);
			}
		},
		avatar: {
			permLvl: "everyone",
			execute: function (msg) {
				var user = msg.mentions.users.first()
				if(user != undefined && user != null) {
					printMsg(msg, user.avatarURL);
				} else {
					printMsg(msg, "Invalid user");
				}
			}
		},
		profile: {
			permLvl: "everyone",
			execute: async function (msg) {
				const storage = require('./storage.js');
				let user = msg.mentions.users.first();
				if(user == undefined) {
					//There is no mentions
					user = msg.author;
				}

				let userData = await storage.getUser(msg, user.id);
				let progression = levels.getProgression(userData.xp);
				let level = progression[0];
				let xpToNextLevel = `${progression[1]}/${levels.getXpForLevel(level)}`;

				var embed = new Discord.RichEmbed();
				embed.title=`${user.username}'s profile`;
				embed.setThumbnail(url=user.avatarURL)
				embed.addField(name="Level: ", value=`${level} (${xpToNextLevel})`, inline=true)
				embed.addField(name="Warnings", value=userData.warnings, inline=true)
				embed.addField(name="Total XP", value=userData.xp, inline=true)
				embed.setFooter(text=`Client id: ${user.id}`)
				msg.channel.send({embed});
			}
		},
		say: {
			permLvl: "roleModo",
			execute: function (msg) {
				let messageToSay = msg.content.split(' ').slice(1);
				let channel;

				//Try to find which channel to send message
				if(messageToSay[0] == 'here') {
					channel = msg.channel;
				} else {
					let id = messageToSay[0].match(/<#(.*?)>/);
					if(id != undefined) {
						channel = client.channels.get(id[1]);
					}
				}

				messageToSay = messageToSay.slice(1).join(' ');

				//Check arguments
				if(channel == undefined) {
					channel = msg.channel;
					messageToSay = 'Missing argument: channel';
				}

				console.log(messageToSay);
				if(messageToSay == undefined || messageToSay == '') {
					messageToSay = 'Missing argument: message';
				}

				//Send message
				channel.send(messageToSay);
			}
		}
	}

	var keys = Object.keys(commands);

	/*
	*Function fired when a message is posted
	*to check if the message is calling a command
	*/
	client.on('message', msg => {
		//Ignore bot
		if (msg.author.bot) return;
		levels.newMessage(msg);
		if (msg.author != client.user) {
			let cmd = msg.content.split(config.prefix).slice(1);
			if(cmd[0] != undefined) {
				cmd = cmd[0].split(' ');
			}

			if(cmd[0] in commands) {
				console.log(msg.author.username + ' - ' + msg.content);
				commands[cmd[0]].execute(msg);
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

	function modifyText(file, text, value) {
		fs.readFile(file, 'utf8', function (err,data) {
			if (err) {
				return console.log(err);
			}
			var result = data.replace(text, value);

			fs.writeFile(file, result, 'utf8', function (err) {
				if (err) return console.log(err);
			});
		});
	}

	//Create the help message
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
						helpString += config.prefix + help[category[listCmd]][n].name + help[category[listCmd]][n].args + ' : [' +
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
			clearList.push(config.prefix + keys[i]);
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
