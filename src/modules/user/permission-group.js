const bot = require('../../bot.js');
const storage = require('../../storage.js');
const sql = require('sqlite');
const config = require('../../args.js').getConfig()[1];
var lang = require('../../localization.js').getLocalization();

module.exports = {
  setGroupCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'setgroup',
        aliases: [],
        category: 'user',
        permLvl: 3
      });
    }
    async execute(msg, args) {
      await module.exports.setGroup(msg, msg.mentions.users.first(), args[1]);
    }
  },
  unsetGroupCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'unsetgroup',
        aliases: ['ungroup'],
        category: 'user',
        permLvl: 3
      });
    }
    async execute(msg, args) {
      await module.exports.unsetGroup(msg, msg.mentions.users.first(), args[1]);
    }
  },
  purgeGroupsCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'purgegroups',
        aliases: ['gpurge'],
        category: 'user',
        permLvl: 3
      });
    }
    async execute(msg, args) {
      await purgeGroups(msg);
    }
  },
  setGroup: function(msg, user, group) {
    var groups = config.groups;

    //Check if there is a user in msg
    if (user == undefined) {
      //Invalid argument: user
      bot.printMsg(msg, lang.error.invalidArg.user);
      return;
    }
    //Check if there is a group in msg
    if (group == undefined) {
      //Missing argument: group
      bot.printMsg(msg, lang.error.missingArg.group);
      return;
    }

    //Put first character of group in uppercase
    group = group.charAt(0).toUpperCase() + group.slice(1);

    return new Promise((resolve, reject) => {
      //Check if group exists
      if (groups.find(x => x.name == group) != undefined) {
        //Get existing groups
        storage.getUser(msg, user.id).then(row => {
          existingGroups = (row.groups != null) ? row.groups.split(',') : [];

          //Check for duplicate
          if (existingGroups.find(x => x == group)) {
            bot.printMsg(msg, lang.error.groupDuplicate);
            resolve()
            return;
          }
          sql.open(config.pathDatabase).then(() => {
            sql.get('SELECT * FROM users WHERE serverId = ? AND userId = ?', [msg.guild.id, user.id]).then(row => {
              if (!row) {
                //Table exist but not row
                sql.run('INSERT INTO users (serverId, userId, xp, warnings, groups) VALUES (?, ?, ?, ?, ?)', [msg.guild.id, user.id, 0, 0, group]).then(() => {
                  resolve();
                });
              } else {
                existingGroups.push(group);
                sql.run("UPDATE users SET groups = ? WHERE serverId = ? AND userId = ?", [existingGroups.toString(), msg.guild.id, user.id]).then(() => {
                  resolve();
                });
              }
              bot.printMsg(msg, lang.setgroup.newGroup);
            }).catch(() => {
              sql.run("CREATE TABLE IF NOT EXISTS users (serverId TEXT, rank TEXT, roleId TEXT)").then(() => {
                //Table don't exist
                sql.run('INSERT INTO users (serverId, userId, xp, warnings, groups) VALUES (?, ?, ?, ?, ?)', [msg.guild.id, user.id, 0, 0, group]).then(() => {
                  bot.printMsg(msg, lang.setgroup.newGroup);
                  resolve();
                });
              }).catch(error => {
                console.log(error);
                reject()
              });
            });
            sql.close();
          }).catch(error => {
            console.log(error);
            reject()
          });
        });
      } else {
        //Group don't exists
        bot.printMsg(msg, lang.error.notFound.group);
        resolve()
      }
    });
  },
  unsetGroup: function(msg, user, group) {
    var groups = config.groups;

    //Check if there is a user in msg
    if (user == undefined) {
      //Invalid argument: user
      bot.printMsg(msg, lang.error.invalidArg.user);
      return;
    }
    //Check if there is a group in msg
    if (group == undefined) {
      //Missing argument: group
      bot.printMsg(msg, lang.error.missingArg.group);
      return;
    }

    //Put first character of group in uppercase
    group = group.charAt(0).toUpperCase() + group.slice(1);

    return new Promise((resolve, reject) => {
      //Check if group exists
      if (groups.find(x => x.name == group) != undefined) {
        //Get existing groups
        storage.getUser(msg, user.id).then(row => {
          existingGroups = (row.groups != null) ? row.groups.split(',') : [];

          sql.open(config.pathDatabase).then(() => {
            sql.get('SELECT * FROM users WHERE serverId = ? AND userId = ?', [msg.guild.id, user.id]).then(row => {
              if (!row) {
                //Table exist but not row
                sql.run('INSERT INTO users (serverId, userId, xp, warnings, groups) VALUES (?, ?, ?, ?, ?)', [msg.guild.id, user.id, 0, 0, groups[0].name]).then(() => {
                  msg.channel.send(lang.unsetgroup.notInGroup);
                  resolve();
                });
              } else {
                let index = existingGroups.indexOf(group);
                if (index > -1) {
                  existingGroups.splice(index, 1)
                  if (existingGroups.length < 2 && existingGroups[0] == '') {
                    //No group
                    existingGroups = null;
                  } else {
                    existingGroups = existingGroups.toString()
                  }

                  sql.run("UPDATE users SET groups = ? WHERE serverId = ? AND userId = ?", [existingGroups, msg.guild.id, user.id]).then(() => {
                    bot.printMsg(msg, lang.unsetgroup.removed);
                    resolve();
                  });
                } else {
                  bot.printMsg(msg, lang.unsetgroup.notInGroup);
                  resolve();
                }
              }
            }).catch(() => {
              sql.run("CREATE TABLE IF NOT EXISTS users (serverId TEXT, rank TEXT, roleId TEXT)").then(() => {
                //Table don't exist
                sql.run('INSERT INTO users (serverId, userId, xp, warnings, groups) VALUES (?, ?, ?, ?, ?)', [msg.guild.id, user.id, 0, 0, groups[0].name]).then(() => {
                  msg.channel.send(lang.unsetgroup.notInGroup);
                  resolve();
                });
              }).catch(error => {
                console.log(error);
                reject();
              });
            });
            sql.close();
          }).catch(error => {
            console.log(error);
            reject();
          });
        });
      } else {
        //Group don't exists
        bot.printMsg(msg, lang.error.notFound.group);
        resolve();
      }
    });
  },
}

function purgeGroups(msg) {
  var user = msg.mentions.users.first();

  //Check if there is a user in msg
  if (user == undefined) {
    //Invalid argument: user
    bot.printMsg(msg, lang.error.invalidArg.user);
    return;
  }

  return new Promise((resolve, reject) => {
    sql.open(config.pathDatabase).then(() => {
      sql.run('CREATE TABLE IF NOT EXISTS users (serverId TEXT, userId TEXT, xp INTEGER, warnings INTEGER, groups TEXT)')
        .then(() => {
          sql.run('UPDATE users SET groups = null WHERE serverId = ? AND userId = ?', [msg.guild.id, user.id]).then(() => {
            bot.printMsg(msg, lang.purgegroups.purged);
            resolve();
          }).catch(error => {
            console.log(error);
            reject();
          });
        });
      sql.close();
    }).catch(error => {
      console.log(error);
      reject();
    });
  });
}
