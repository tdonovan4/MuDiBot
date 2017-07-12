exist = function(obj, key) {
	return key.split(".").every(function(x) {
		if(typeof obj != "object" || obj === null || ! x in obj)
		return false;
		obj = obj[x];
		return true;
	});
}


//Handle warnings
const storage = require('./storage.js');
const bot = require('./bot.js');

module.exports = {
	warningList: null,
	warn: function (msg) {
		var file = './storage/warning.list-' + msg.guild.id + '.json';
		let args = msg.content.split(" ").slice(1);
		let users = msg.mentions.users.array();
		var warningList;

		//Check if there is arguments
		if(args.length > 0) {
			//Check if the file exist
			storage.exist(file);
			if (storage.empty(file)) {
				console.log('Warning file don\'t exist, creating one')
				warningList = {}
				storage.write(file, warningList);
			} else {
				warningList = storage.read(file);
			}

			var warnCmd = {
				clear: {
					all: function () {
						storage.delete (file);
						bot.printMsg(msg, 'Storage cleared');
					},
					user: function () {
						console.log(args[1]);
						warningList[args[1]] = undefined;
						storage.write(file, warningList);
						bot.printMsg(msg, 'User cleared');
					}
				},
				list: {
					undefined: function () {
						var string = '';
						if (!Object.keys(warningList).length > 0) {
							bot.printMsg(msg, 'Empty');
						}

						for (i = 0; i < Object.keys(warningList).length; i++) {
							if (i !== 0) {
								string += '\n';
							}
							var user = Object.keys(warningList)[i]
							string += user + ': ' + warningList[user] + ' warnings';
						}
						bot.printMsg(msg, string);
					},
					user: function () {
						var string = '';
						if (!Object.keys(warningList).length > 0) {
							bot.printMsg(msg, 'Empty');
						}

						if (args[1].includes(users[0].id)) {
							string += args[1] + ': ' + warningList[args[1]] + ' warnings';
						}
						bot.printMsg(msg, string);
					}
				},
				remove: {
					user: function () {
						if (args[1] in warningList) {
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
				},
				user: function () {
					//Add one warn on user if no second arg
					if (args[0]in warningList) {
						warningList[args[0]] += 1;
					} else {
						warningList[args[0]] = 1;
					}
					storage.write(file, warningList);
					bot.printMsg(msg, args[0] + ': ' + warningList[args[0]] + ' warnings');
				}
			}
			checkKeys();

			function checkKeys() {
				let i = args.length - 1
				let obj = (i < 1) ? warnCmd:warnCmd[args[0]];
				let keys = (i < 1) ? args[0]:args[0] + '.' + args[1];

				if (exist(warnCmd, keys) && typeof obj[args[i]] === "function") {
					//If arg is in warnCmd
					obj[args[i]]();
				} else if (typeof users[0] != 'undefined' && args[i].includes(users[0].id)) {
					//If arg is a user
					obj['user']();
				} else if (args[1] == undefined) {
					//If arg is undefined
					if (exist(warnCmd, args[i] + '.' + 'undefined')) {
						obj[args[i]]['undefined']();
					} else {
						bot.printMsg(msg, 'Wrong usage');
					}
				} else {
					bot.printMsg(msg, 'Wrong usage');
				}
			}
		} else {
			bot.printMsg(msg, 'Wrong usage');
		}
	}
}
