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
		var file = './storage/' + msg.guild.id + '.json';
		let args = msg.content.split(" ").slice(1);
		let users = msg.mentions.users.array();

		//Check if there is arguments
		if(args.length > 0) {
			//Check if the file exist
			storage.checkStorageFile(file, msg);

			var storageFile = storage.read(file);
			var warningList;

			var warnCmd = {
				clear: {
					all: function () {
						for (i = 0; i < Object.keys(storageFile.users).length; i++) {
							var user = Object.keys(storageFile.users)[i];
							storageFile.users[user].warnings = 0;
						}
						storage.write(file, storageFile);
						bot.printMsg(msg, 'Storage cleared');
					},
					user: function () {
						storageFile.users[users[0].id].warnings = 0;
						storage.write(file, storageFile);
						bot.printMsg(msg, 'User cleared');
					}
				},
				list: {
					undefined: function () {
						var string = '';
						if (!Object.keys(storageFile.users).length > 0) {
							bot.printMsg(msg, 'Empty');
						}

						for (i = 0; i < Object.keys(storageFile.users).length; i++) {
							var user = Object.keys(storageFile.users)[i]
							warningList = storageFile.users[user].warnings;

							if(warningList !== 0) {
								if (i !== 0) {
									string += '\n';
								}

								string += '<@' + user + '>' + ': ' + warningList + ' warnings';
							}
						}
						if(string === '') {
							string = "There is no warnings";
						}
						bot.printMsg(msg, string);
					},
					user: function () {
						var string = '';
						warningList = storageFile.users[users[0].id].warnings = 0;

						if (!Object.keys(warningList).length > 0) {
							bot.printMsg(msg, 'Empty');
						}

						if (args[1].includes(users[0].id)) {
							string += args[1] + ': ' + warningList + ' warnings';
						}
						bot.printMsg(msg, string);
					}
				},
				remove: {
					user: function () {
						storage.checkUser(file, msg, users[0]);
						//update storageFile
						var storageFile = storage.read(file);
						if(storageFile.users[users[0].id].warnings > 0) {
							storageFile.users[users[0].id].warnings--;
							warningList = storageFile.users[users[0].id].warnings;

							storage.write(file, storageFile);
							bot.printMsg(msg, args[1] + ': ' + warningList + ' warnings');
						} else {
							bot.printMsg(msg, "User already have 0 warnings")
						}
					}
				},
				user: function () {
					storage.checkUser(file, msg, users[0]);
					//update storageFile
					var storageFile = storage.read(file);
					//Add one warn on user if no second arg
					storageFile.users[users[0].id].warnings++;
					warningList = storageFile.users[users[0].id].warnings;

					storage.write(file, storageFile);

					bot.printMsg(msg, args[0] + ': ' + warningList + ' warnings');
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
