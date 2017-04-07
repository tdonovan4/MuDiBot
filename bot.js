const Discord = require("discord.js");
const client = new Discord.Client();
const config = require('../config.json');

client.login(config.botID);

client.on('ready', () => {
	console.log(`Logged in as ${client.user.username}!`);
	client.user.setGame('Being a badass bot');
});

var commands = ['ping', '$gif', '$clearlog', '$join', '$hello', '$quit', '$help',
'$restart', '$info', '$tnt', '$stop'];
var perm = ['everyone', config.roleMember, config.roleModo, config.roleMember,
'everyone', 'everyone', 'everyone', config.roleModo, 'everyone', 'everyone', config.roleModo];

client.on('message', msg => {
	if (msg.author.id != "290581674343792651") {
		if (msg.content === commands[0] && checkRole(msg, perm[0])) {
			msg.reply('Pong!');
			console.log(commands[0]);
		}
		
		if (msg.content === commands[1] && checkRole(msg, perm[1])) {
			msg.reply('http://giphy.com/gifs/l4FGBpKfVMG4qraJG');
			console.log(commands[1]);
		}
		if (msg.content.includes(commands[2]) && checkRole(msg, perm[2])) {
			let args = msg.content.split(" ").slice(1);
			let num = args[0];
			
			if(num === null || isNaN(num)) {
				num = '50';
			}
			
			clear(msg, num);
			console.log(commands[2]);			
		}
		if (msg.content === commands[3] && checkRole(msg, perm[3])) {  		
			play(1, msg);
			console.log(commands[3]);			
		}
		
		if (msg.content === commands[4] && checkRole(msg, perm[4])) {  	
			play(2, msg);
			msg.reply('Hi!')
			console.log(commands[4]);
		}
		
		if (msg.content === commands[5] && checkRole(msg, perm[5])) {
			play(0, msg);
			console.log(commands[5]);
		}
		if (msg.content === commands[6] && checkRole(msg, perm[6])) {
			var roles = msg.channel.guild.roles;
			msg.channel.send('~Help~'+ '\n' +
			commands[0] + ' : [' + mention(roles, perm[0]) + '] Pong!'+ '\n' +
			commands[1] + ' : [' + mention(roles, perm[1]) + '] Inserts a little GIF'+ '\n' +
			commands[2] + ' <messages to check> : [' + mention(roles, perm[2]) + '] Deletes all commands related to the bot'+ '\n' +
			commands[3] + ' : [' + mention(roles, perm[3]) + '] Makes the bot play a nice song'+ '\n' +
			commands[4] + ' : [' + mention(roles, perm[4]) + '] Hello!'+ '\n' +
			commands[5] + ' : [' + mention(roles, perm[5]) + '] Makes the bot quit the voice channel'+ '\n' +
			commands[6] + ' : [' + mention(roles, perm[6]) + '] Displays this'+ '\n' +
			commands[7] + ' : [' + mention(roles, perm[7]) + '] Restarts the bot'+ '\n' +
			commands[8] + ' : [' + mention(roles, perm[8]) + '] Displays information about the bot'+ '\n' +
			commands[9] + ' : [' + mention(roles, perm[9]) + '] TNT <3'+ '\n' +
			commands[10] + ' : [' + mention(roles, perm[10]) + '] Kills the process');
			console.log(commands[6]);
		}
		if (msg.content === commands[7] && checkRole(msg, perm[7])) {
			
			var spawn = require('child_process').spawn;
			
			var child = spawn('node', ['bot.js'], { 
				detached: true,
				shell: true,
				stdio: 'ignore'
			});
			
			child.unref();
			
			console.log('Restarting');
			
			console.log(commands[7]);
			process.exitCode = 0;
			process.exit();
		}
		if (msg.content === commands[8] && checkRole(msg, perm[8])) {
			var pjson = require('./package.json');
			
			msg.channel.send('~Infos~ \n' +
			'Name: ' + pjson.name + '\n' +
			'Version: ' + pjson.version + '\n' +
			'Description: ' + pjson.description + '\n' +
			'Author: ' + pjson.author + '\n' +
			'Uptime: ' + time() + '\n' +
			'RoleMember: ' + config.roleMember + '\n' +
			'RoleModo: ' + config.roleModo);
			
			console.log(commands[8]);
		}
		if (msg.content === commands[9] && checkRole(msg, perm[9])) {
			msg.reply('ssSSSsss...');
			play(3, msg);
			console.log(commands[9]);
		}
		if (msg.content === commands[10] && checkRole(msg, perm[10])) {
			console.log(commands[10]);
			process.exitCode = 0;
			process.exit();
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
				} else if(messages.array()[i].content.includes(commands[2])) {
				messages.array()[i].delete()
				} else {
				for(var n = 0; n < commands.length; n++) {
					if(messages.array()[i].content === commands[n]) {
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
		} else {
		return roles.find("name", role);
	}
}

var currentVoice;

function play(i, message) {
	var channel = message.member.voiceChannel;
	if(channel != null) {
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
	if(role === config.roleMember) {
		permLevel = 1;
		} else if(role === config.roleModo) {
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