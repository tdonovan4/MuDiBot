const sql = require('sqlite');
const config = require('../../args.js').getConfig()[1];

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
  for(table of tables) {
    //Table don't exist, creating
    await sql.run(`CREATE TABLE IF NOT EXISTS ${table.name} (${table.values.join(', ')})`);
  }
  //Wait for all promises
  await sql.close();
}
