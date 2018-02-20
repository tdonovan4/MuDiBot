//Handle SQL
const sql = require('sqlite');
const config = require('./args.js').getConfig()[1];
const checkTable = 'CREATE TABLE IF NOT EXISTS users (serverId TEXT, userId TEXT, xp INTEGER, warnings INTEGER, groups TEXT)';

function insertUser(msg, userId) {
  return new Promise((resolve, reject) => {
    sql.run('INSERT INTO users (serverId, userId, xp, warnings, groups) VALUES (?, ?, ?, ?, ?)', [msg.guild.id, userId, 0, 0, config.groups[0]])
      .catch(error => {
        console.log(error);
      });

    //Try to get user after he was created
    sql.get('SELECT * FROM users WHERE serverId = ? AND userId = ?', [msg.guild.id, userId])
      .then(row => {
        resolve(row);
      }).catch(error => {
        console.log(error); //Really nasty errors...
      });
  });
}

module.exports = {
  getUsers: function(msg) {
    return new Promise((resolve, reject) => {
      sql.open('./storage/data.db').then(() => {
        sql.all('SELECT * FROM users WHERE serverId = ?', msg.guild.id)
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
        sql.close();
      }).catch(error => {
        console.log(error);
      });
    });
  },
  getUser: function(msg, userId) {
    return new Promise((resolve, reject) => {
      sql.open('./storage/data.db').then(() => {
        sql.get('SELECT * FROM users WHERE serverId = ? AND userId = ?', [msg.guild.id, userId])
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
              }).catch(error => {
                console.log(error);
              });
          });
        sql.close();
      }).catch(error => {
        console.log(error);
      });
    });
  }
}
