const sql = require('sqlite');
const mustache = require('mustache');
const fs = require('fs');
const config = require('../../args.js').getConfig()[1];
var lang = require('../../localization.js').getLocalization();

var Table = class {
  constructor(name, values) {
    this.name = name
    this.values = values
  }
}

var baselineTables = [
  new Table('users', [
    'serverId TEXT',
    'userId TEXT',
    'xp INTEGER',
    'warnings INTEGER',
    `groups TEXT`
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

async function getDatabaseVersion() {
  var version;
  var databaseSettings = await sql.get('SELECT count(*) FROM sqlite_master ' +
    'WHERE type="table" AND name="database_settings"');
  if (databaseSettings['count(*)'] == 1) {
    //Database settings exists, checking version
    version = await sql.get('SELECT version FROM database_settings');
  }
  //Return the version
  return version;
}

async function addMissingTables(tables) {
  var addedTablesCount = 0;
  //Check if each tables exists
  for (var i = 0; i < tables.length; i++) {
    var count = await sql.get('SELECT count(*) FROM sqlite_master ' +
      `WHERE type='table' AND name='${tables[i].name}'`);
    if (count['count(*)'] == 0) {
      //Table don't exist, creating
      await sql.run(`CREATE TABLE ${tables[i].name} (${tables[i].values.join(', ')})`);
      addedTablesCount++;
    }
  }
  return addedTablesCount;
}

function versionString(integer) {
  return integer.toString().padStart(3, '0');
}

async function updateDatabaseVersion(version) {
  var date = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
  await sql.run('INSERT INTO database_settings (version, date) VALUES (?,?)', [version, date]);
}

async function updateDatabase(version, lastVersion) {
  //Send update message
  console.log(mustache.render(lang.database.newVersion, {
    current: versionString(version),
    new: versionString(lastVersion)
  }));
  //Make a backup
  var dbFile = fs.readFileSync(config.pathDatabase);
  var newPath = config.pathDatabase.split('/');
  //Rename last part of path
  newPath[newPath.length - 1] = `database-backup-v${versionString(version)}.db`
  newPath = newPath.join('/');
  fs.writeFileSync(newPath, dbFile);

  for (var i = version + 1; i <= lastVersion; i++) {
    try {
      var file = fs.readFileSync('./src/modules/database/scripts/' +
        `${versionString(i)}.sql`);
      //Parse variable
      file = file.toString().replace('$[default_group]', config.groups[0].name);
      await sql.exec(file);
      //Update database with new version
      await updateDatabaseVersion(i);
      //Success
      console.log(mustache.render(lang.database.updated, {
        version: versionString(i)
      }));
    } catch (e) {
      console.error(e);
      break;
    }
  }
}

module.exports.check = async function() {
  await sql.open(config.pathDatabase);
  //Get last version using the last scripts
  var scripts = fs.readdirSync('./src/modules/database/scripts');
  var lastVersion = scripts[scripts.length - 1].slice(0, 3);

  //Get database version
  var version = await getDatabaseVersion();
  //Handle if verson is null
  if (version == null) {
    //Starting from first version
    version = 0;
    console.log(lang.database.noVersion);
    //Add missing baseline tables
    var addedTablesCount = await addMissingTables(baselineTables);
    if (addedTablesCount) {
      //Display number of tables added
      console.log(mustache.render(lang.database.tableAdded, {
        num: addedTablesCount
      }));
    }
  }

  //Check if the database need updating
  if (version < lastVersion) {
    //Update database using sql scripts
    await updateDatabase(version, lastVersion);
  } else {
    //All clear
    console.log(lang.database.clear);
  }
  await sql.close();
}
