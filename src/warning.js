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
	warn: async function (msg) {
		let args = msg.content.split(" ").slice(1);
		let users = msg.mentions.users.array();

		//Check if there is arguments
		if(args.length > 0) {

			var warnCmd = {
				clear: {
					all: function () {
						storage.modifyUsers(msg, 'warnings', 0)
						bot.printMsg(msg, 'Storage cleared');
					},
					user: function () {
						var userId = msg.mentions.users.first().id;
						storage.modifyUser(msg, 'warnings', 0)
						bot.printMsg(msg, 'User cleared');
					}
				},
				list: {
					undefined: async function () {
						var users = await storage.getUsers(msg);

						if (users == undefined) {
							bot.printMsg(msg, 'There is no warnings');
						} else {
							var output = '';
							for(i = 0; i < users.length; i++) {
								if(users[i].warnings > 0) {
									if(output !== '') {
										output += '\n';
									}
									output += `<@${users[i].userId}>: ${users[i].warnings} warnings`;
								}
							}
							if(output === '') {
								output = 'There is no warnings';
							}
							bot.printMsg(msg, output);
						}
					},
					user: async function () {
						var user = await storage.getUser(msg)
						bot.printMsg(msg, `${args[1]}: ${user.warnings} warnings`);
					}
				},

				remove: {
					user: async function () {
						var warnings = await storage.getUser(msg);
						warnings = warnings.warnings - 1;

						if(warnings >= 0 && warnings != undefined) {
							var userId = msg.mentions.users.first().id;
							storage.modifyUser(msg, 'warnings', warnings);
							bot.printMsg(msg, args[1] + ': ' + warnings + ' warnings');
						} else {
							bot.printMsg(msg, "User already have 0 warnings")
						}
					}
				},
				user: async function () {
					var warnings = await storage.getUser(msg);
					if(warnings != undefined) {
						warnings = warnings.warnings + 1;

						var userId = msg.mentions.users.first().id;
						storage.modifyUser(msg, 'warnings', warnings);
						bot.printMsg(msg, args[0] + ': ' + warnings + ' warnings');
					}
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
