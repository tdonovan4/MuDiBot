const sql = require('sqlite');
const mustache = require('mustache');
const config = require('../../args.js').getConfig()[1];
var lang = require('../../localization.js').getLocalization();

var Table = class {
  constructor(name, values) {
    this.name = name
    this.values = values
  }
}

var tables = [
  new Table('database_settings', [
    'version TEXT'
  ]),
  new Table('users', [
    'serverId TEXT',
    'userId TEXT',
    'xp INTEGER DEFAULT 0',
    'warnings INTEGER DEFAULT 0',
    `groups TEXT DEFAULT "${config.groups[0].name}"`,
    'CONSTRAINT users_unique UNIQUE (serverId, userId)'
  ]),
  new Table('servers', [
    'serverId TEXT',
    'defaultChannel TEXT'
  ]),
  new Table('rewards', [
    'serverId TEXT',
    'rank TEXT',
    'reward TEXT'
  ]),
  new Table('customCmds', [
    'serverId TEXT',
    'userId TEXT',
    'name TEXT',
    'action TEXT',
    'arg TEXT'
  ])
];

module.exports.check = async function() {
  await sql.open(config.pathDatabase);
  //Check if each tables exists
  var tablesToVerify = tables;
  for (var i = 0; i < tables.length; i++) {
    var count = await sql.get(`SELECT count(*) FROM sqlite_master WHERE type='table' AND name='${tables[i].name}'`);
    if (count['count(*)'] == 0) {
      //Table don't exist, creating
      await sql.run(`CREATE TABLE IF NOT EXISTS ${tables[i].name} (${tables[i].values.join(', ')})`);
      //Mark to be removed (no need to test)
      tablesToVerify[i] = null
    }
  }
  //Remove null values
  tablesToVerify = tablesToVerify.filter(x => x != null);
  //Display number of tables added
  console.log(mustache.render(lang.database.table.added, {
    num: tables.length - tablesToVerify.length
  }));
  //Wait for all promises
  await sql.close();
}
