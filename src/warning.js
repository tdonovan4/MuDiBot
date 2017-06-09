//Handle warnings
const storage = require('./storage.js');
const bot = require('./bot.js');

module.exports = {
	warningList: null,
	//TODO: Split in multiple functions
	warn: function (msg) {
		var file = './storage/warning.list-' + msg.guild.id + '.json';
		console.log(bot);
		let args = msg.content.split(" ").slice(1);
		let users = msg.mentions.users.array();
		var warningList;

		//Check if the file exist
		storage.exist(file);
		if (storage.empty(file)) {
			console.log('Warning file don\'t exist, creating one')
			warningList = {}
			storage.write(file, warningList);
		} else {
			warningList = storage.read(file);
		}

		switch (args[0]) {
		case undefined:
			bot.printMsg(msg, 'Not enough arguments')
			break;
		case 'clear':
			if (args[1] == null) {
				bot.printMsg(msg, 'Not enough arguments');
			} else if (args[1] === 'all') {
				storage.delete(file);
				bot.printMsg(msg, 'Storage cleared');
			} else {
				if (args[1].includes(users[0].id)) {
					console.log(args[1]);
					warningList[args[1]] = undefined;
					storage.write(file, warningList);
					bot.printMsg(msg, 'User cleared');
				}
			}
			break;
		case 'list':
			var string = '';
			if (!Object.keys(warningList).length > 0) {
				bot.printMsg(msg, 'Empty');
			} else {
				if (args[1] != null) {
					if (args[1].includes(users[0].id)) {
						string += args[1] + ': ' + warningList[args[1]] + ' warnings';
					}
				} else {
					for (i = 0; i < Object.keys(warningList).length; i++) {
						if (i !== 0) {
							string += '\n';
						}
						var user = Object.keys(warningList)[i]
						string += user + ': ' + warningList[user] + ' warnings';
					}
				}
				bot.printMsg(msg, string);
			}
			break;

		case 'remove':
			if (args[1].includes(users[0].id)) {
				if (args[1]in warningList) {
					warningList[args[1]] -= 1;
					msg.channel.send(args[1] + ': ' + warningList[args[1]] + ' warnings');
					storage.write(file, warningList);
					if (warningList[args[1]] <= 0) {
						warningList[args[1]] = undefined;
						storage.write(file, warningList);
						bot.printMsg(msg, 'User cleared');
					}
				}
			}
			break;
		default:
			//Add one warn on user if no second arg
			if (args[0].includes(users[0].id)) {
				if (args[0]in warningList) {
					warningList[args[0]] += 1;
				} else {
					warningList[args[0]] = 1;
				}
				storage.write(file, warningList);
				bot.printMsg(msg, args[0] + ': ' + warningList[args[0]] + ' warnings');
			}
		}
	}
}
