//Handle warnings
const storage = require('./storage.js');
module.exports = {
	warningList: null,
	//TODO: Split in multiple functions
	warn: function (msg) {
		let args = msg.content.split(" ").slice(1);
		let users = msg.mentions.users.array();
		var warningList;
		
		//Check if the file exist
		storage.exist();
		if (storage.empty()) {
			warningList = {}
			storage.write(warningList);
		} else {
			warningList = storage.read();
		}
		
		switch (args[0]) {
		case undefined:
			console.log('Not enough arguments');
			break;
		case 'clear':
			if (args[1] == null) {
				console.log('Not enough arguments');
			} else if (args[1] === 'all') {
				storage.delete ();
				console.log('Storage cleared');
			} else {
				if (args[1].includes(users[0].id)) {
					console.log(args[1]);
					warningList[args[1]] = undefined;
					storage.write(warningList);
					console.log('User cleared');
				}
			}
			break;
		case 'list':
			var string = '';
			if (args[1] != null) {
				if (args[1].includes(users[0].id)) {
					string += args[1] + ': ' + warningList[args[1]] + ' warnings\n';
				}
			} else {
				for (i = 0; i < Object.keys(warningList).length; i++) {
					var user = Object.keys(warningList)[i]
						string += user + ': ' + warningList[user] + ' warnings\n';
				}
			}
			msg.channel.send(string);
			break;
			
			
		case 'remove':
			if (args[1].includes(users[0].id)) {
				if (args[1]in warningList) {
					warningList[args[1]] -= 1;
					msg.channel.send(args[1] + ': ' + warningList[args[1]] + ' warnings');
					storage.write(warningList);
					if (warningList[args[1]] <= 0) {
						warningList[args[1]] = undefined;
						storage.write(warningList);
						console.log('User cleared');
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
				storage.write(warningList);
				msg.channel.send(args[0] + ': ' + warningList[args[0]] + ' warnings');
			}
		}
	}
}
