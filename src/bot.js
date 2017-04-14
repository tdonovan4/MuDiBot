//TODO: Put more comments
//TODO: Divide this class in multiple smaller classes
const Discord = require("discord.js");
const client = new Discord.Client();
const config = require('../config.js')
const data = require('./command-data.json');
const storage = require('./storage.js');
var localization;

client.login(config.botID);

client.on('ready', () => {
	console.log(`Logged in as ${client.user.username}!`);
	if(config.language === 'french') {
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
		}
		
		if (msg.content === data.commands[1] && checkRole(msg, data.perm[1])) {
			msg.reply('http://giphy.com/gifs/l4FGBpKfVMG4qraJG');
			console.log(data.commands[1]);
		}
		if (msg.content.includes(data.commands[2]) && checkRole(msg, data.perm[2])) {
			let args = msg.content.split(" ").slice(1);
			let num = args[0];
			
			if(num === null || isNaN(num)) {
				num = '50';
			}
			
			clear(msg, num);
			console.log(data.commands[2]);			
		}
		if (msg.content === data.commands[3] && checkRole(msg, data.perm[3])) {  		
			play(1, msg);
			console.log(data.commands[3]);			
		}
		
		if (msg.content === data.commands[4] && checkRole(msg, data.perm[4])) {  	
			play(2, msg);
			msg.reply(localization.botReply[1])
			console.log(data.commands[4]);
		}
		
		if (msg.content === data.commands[5] && checkRole(msg, data.perm[5])) {
			play(0, msg);
			console.log(data.commands[5]);
		}
		if (msg.content === data.commands[6] && checkRole(msg, data.perm[6])) {
			var roles = msg.channel.guild.roles;
			var helpString = '~Help~'+ '\n'
			for(i = 0; i < data.commands.length; i++) {
				helpString += data.commands[i] + localization.helpArg[i] + ' : [' + mention(roles, data.perm[i]) + 
				'] ' + localization.helpMsg[i] + '\n'
			}
			msg.channel.send(helpString);
			console.log(data.commands[6]);
		}
		if (msg.content === data.commands[7] && checkRole(msg, data.perm[7])) {
			
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
		}
		if (msg.content === data.commands[8] && checkRole(msg, data.perm[8])) {
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
		}
		if (msg.content === data.commands[9] && checkRole(msg, data.perm[9])) {
			msg.reply(localization.botReply[3]);
			play(3, msg);
			console.log(data.commands[9]);
		}
		if (msg.content === data.commands[10] && checkRole(msg, data.perm[10])) {
			console.log(data.commands[10]);
			process.exitCode = 0;
			process.exit();
		}
		if (msg.content.includes(data.commands[11]) && checkRole(msg, data.perm[11])) {
			let args = msg.content.split(" ").slice(1);
			let users = msg.mentions.users.array();
			var warningList;
			
			storage.exist();
			if(storage.empty()) {
				warningList = {}
				storage.write(warningList);
				} else {
				warningList = storage.read();
			}
			//TODO: Use switch
			if(args[0] == null) {
				console.log('Not enough arguments');
				} else if(args[0] === 'clear') {
				if(args[1] == null) {
					console.log('Not enough arguments');
					} else if(args[1] === 'all') {
					storage.delete();
					console.log('Storage cleared');
					} else {
					for(i = 0; i < users.length; i++) {
						if(args[1].includes(users[i].id)) {
							console.log(args[1]);
							warningList[args[1]] = undefined;
							storage.write(warningList);
							console.log('User cleared');
						}
					}
				}
				}else if(args[0] === 'list') {
				var string = '';
				for(i = 0; i < Object.keys(warningList).length; i++) {
					var user = Object.keys(warningList)[i]
					string += user + ': ' + warningList[user] + ' warnings\n';
					console.log(user);
				}
				msg.channel.send(string);
				} else {
				for(i = 0; i < users.length; i++) {
					if(args[0].includes(users[i].id)) {
						if (args[0] in warningList) {
							warningList[args[0]] += 1;
							} else {
							warningList[args[0]] = 1;
						}
						storage.write(warningList);
						msg.channel.send(args[0] + ': ' + warningList[args[0]] + ' warnings');
					}
				}
			}
			console.log(data.commands[11]);
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

var commandsToClear = ['.play', '.q', '.skip', '.stop'];

function clear(msg, num) {
	msg.channel.fetchMessages({limit: parseInt(num)})
	.then(messages => { 
		console.log(num)
		for(var i = 0; i < messages.array().length; i++) {
			if(messages.array()[i].author.id === "290581674343792651" || 
			messages.array()[i].author.id === "155149108183695360") {
				messages.array()[i].delete()
				} else if(messages.array()[i].content.includes(data.commands[2]) || messages.array()[i].content.includes(data.commands[11])) {
				messages.array()[i].delete()
				} else {
				for(var n = 0; n < data.commands.length; n++) {
					if(messages.array()[i].content === data.commands[n]) {
						messages.array()[i].delete()
					}
				}
				for(var y = 0; y < commandsToClear.length; y++) {
					if(messages.array()[i].content.includes(commandsToClear[y])) {
						messages.array()[i].delete()
					}
				}	
			}
		}
		console.log('Messages cleared!');
	})
	.catch(console.error);
}

function mention(roles, role) {
	if(role === 'everyone') {
		return '@everyone';
		} else if(role === "roleMember") {
		return roles.find("name", config.roleMember);
		} else if(role === "roleModo") {
		return roles.find("name", config.roleModo);
		} else {
		return null;
	}
}

var currentVoice;

function play(i, message) {
	var channel = message.member.voiceChannel;
	if(typeof channel !== "undefined") {
		if(i === 0) {
			channel.connection.disconnect();
		}	
		if(i === 1) {
			channel.join()
			.then(connection => {
				dispatcher = connection.playFile('./sound/sound.mp3');
				dispatcher.on('end', () => connection.disconnect());
			})
			.catch(console.error);
		}
		if(i === 2) {
			channel.join()
			.then(connection => {
				dispatcher = connection.playFile('./sound/hello.wav');
				dispatcher.on('end', () => connection.disconnect());
			})
			.catch(console.error);
		}
		if(i === 3) {
			channel.join()
			.then(connection => {
				dispatcher = connection.playFile('./sound/explosion.wav');
				dispatcher.on('end', () => {connection.disconnect(); message.reply('Boom!');});
			})
			.catch(console.error);
		}
		currentVoice = channel;
		} else if(i === 3) {
		message.reply('Boom!');
	}
}

function checkRole(msg, role) {
	var permLevel = 0;
	var currentPermLevel = 0;
	
	if(msg.author.id === '265280961409843202') {
		return true;
	}
	var permissions = msg.member.permissions;
	if(permissions.hasPermission('ADMINISTRATOR') || permissions.hasPermission('MANAGE_CHANNELS')) {
		return true;
	}
	if(role === roleMember) {
		permLevel = 1;
		} else if(role === roleModo) {
		permLevel = 2;
	}
	for(i = 0; i < msg.member.roles.array().length; i++) {
		if(msg.member.roles.array()[i].name === config.roleModo) {
			currentPermLevel = 2;
			break;
		}
		if(msg.member.roles.array()[i].name === config.roleMember) {
			currentPermLevel = 1;
		}
	}
	if(currentPermLevel < permLevel) {
		console.log("Not enough permissions");
		return false;
		} else {
		return true;
	}
}

process.on('SIGINT', function () {
	process.exit(2);
});	
