//Handle SQL
const sql = require('sqlite');
sql.open('./storage/data.db');
const checkTable = 'CREATE TABLE IF NOT EXISTS users (serverId TEXT, userId TEXT, xp INTEGER, warnings INTEGER)';

function insertUser(msg, userId) {
	return new Promise((resolve, reject) => {
		sql.run('INSERT INTO users (serverId, userId, xp, warnings) VALUES (?, ?, ?, ?)',
		[msg.guild.id, userId, 0, 0])
		.catch(error => {
			console.log(error);
		});

		//Try to get user after he was created
		sql.get(`SELECT * FROM users WHERE serverId = ${msg.guild.id} AND userId = ${userId}`)
		.then(row => {
			resolve(row);
		}).catch(error => {
			console.log(error); //Really nasty errors...
		});
	});
}

module.exports = {
	modifyUsers: function(msg, row, value) {
		sql.run(checkTable)
		.then(() => {
			sql.run(`UPDATE users SET ${row} = ${value} WHERE serverId = ${msg.guild.id}`).catch(error => {
				console.log(error);
			});
		}).catch(error => {
			console.log(error);
		});
	},
	modifyUser: function(msg, userId, row, value) {
		sql.run(checkTable)
		.then(() => {
			sql.run(`UPDATE users SET ${row} = ${value} WHERE serverId = ${msg.guild.id} AND userId = ${userId}`)
			.catch(error => {
				console.log(error);
			});
		}).catch(error => {
			console.log(error);
		});
	},
	getUsers: function(msg) {
		return new Promise((resolve, reject) => {
			sql.all(`SELECT * FROM users WHERE serverId = ${msg.guild.id}`)
			.then(row => {
				resolve(row);
			}).catch(error => {
				console.log(error); //Nasty errors...

				//Check if table exist
				sql.run(checkTable)
				.then(() => {
					resolve(row);
				}).catch(error => {
					console.log(error);
				});
			});
		});
	},
	getUser: function(msg, userId) {
		return new Promise((resolve, reject) => {
			sql.get(`SELECT * FROM users WHERE serverId = ${msg.guild.id} AND userId = ${userId}`)
			.then(row => {
				if (!row) {
					//User is not defined
					row = insertUser(msg, userId);
				}
				resolve(row);
			}).catch(() => {
				//Check if table exist
				sql.run(checkTable)
				.then(() => {
					row = insertUser(msg, userId).then(() => {
						resolve(row);
					});
				}).catch(() => {
					console.log(error);
				});
			});
		});
	}
}
