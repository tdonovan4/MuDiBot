//Module for checking and fixing database
module.exports.checker = require('./checker.js');
//Module for the users table
module.exports.user = require('./users-db.js');
//Module for the xp leaderboard
module.exports.leaderboard = require('./leaderboard.js');
//Module for servers config table
module.exports.config = require('./config-db.js');
//Module for level rewards table
module.exports.reward = require('./rewards-db.js');
//Module for custom commands table
module.exports.customCmd = require('./custom-cmd-db.js');
