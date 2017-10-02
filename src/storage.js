//Handle writing and reading on files
const fs = require('fs');
//TODO: Add argument for path
module.exports = {
	write: function (file, obj) {
		var json = JSON.stringify(obj, null, '\t');

		fs.writeFileSync(file, json, 'utf8', (err) => {
			if (err){ console.log(err); }
		});
	},

	read: function (file) {
		return JSON.parse(fs.readFileSync(file, 'utf8'));
	},

	checkStorageFile: function (file, msg) {
		var example = this.read('./storage/storage-file-example.json').fileExample;
		//Check if the file as been created
		if (fs.existsSync(file)) {
			var storageFile = this.read(file);
			//Example file
			//TODO: Make this a function
			let exampleKeys = Object.keys(example);

			for(i = 0; i < exampleKeys.length; i++) {
				if(!(exampleKeys[i] in storageFile)) {
					storageFile[exampleKeys[i]] = example[exampleKeys[i]];
				}
			}
			storageFile.server = msg.guild.name;
			this.write(file, storageFile);
		} else {
			example.server = msg.guild.name;
			this.write(file, example);
		}
	},

	checkUser: function (file, msg, user) {
		let example = this.read('./storage/storage-file-example.json').userExample;
		let storageFile = this.read(file);
		//Check if the file as been created
		if(user.id in storageFile.users) {
			//Example file
			let exampleKeys = Object.keys(example);
			for(i = 0; i < exampleKeys.length; i++) {
				if(!(exampleKeys[i] in storageFile.users[user.id])) {
					storageFile.users[user.id][exampleKeys[i]] = example[exampleKeys[i]];
				}
			}
			storageFile.users[user.id].name = user.username;
			this.write(file, storageFile);
		} else {
			storageFile.users[user.id] = example;
			storageFile.users[user.id].name = user.username;
			this.write(file, storageFile);
		}
	},

	delete: function (file) {
		fs.unlinkSync(file);
	}
}
