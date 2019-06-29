const sql = require('sqlite');
const mustache = require('mustache');
const fs = require('fs');
const util = require('../../util.js');
const config = util.getConfig()[1];
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

function getLastVersion() {
  //Get last database version using the last scripts
  var scripts = fs.readdirSync('./src/modules/database/scripts');
  scripts = scripts.map(script => {
    //Get only first 3 characters and try to convert them to int
    script = Number(script.slice(0, 3));
    if (isNaN(script)) {
      //This is not a valid version number, change it to 0
      script = 0;
    }
    return script;
  });
  //Return max number from the array of script versions
  return Math.max(...scripts);
}

async function getDatabaseVersion() {
  var version;
  var databaseSettings = await sql.get('SELECT count(*) FROM sqlite_master ' +
    'WHERE type="table" AND name="database_settings"');
  if (databaseSettings['count(*)'] == 1) {
    //Database settings exists, checking version
    version = await sql.get('SELECT version FROM database_settings ' +
      'ORDER BY version DESC LIMIT 1')
    if (version != undefined) {
      version = version.version;
    }
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
  var date = util.toDbDate(new Date());
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
      file = file.toString();
      //Add variables
      file = file.replace(/\$\[default_group]/g, config.groups[0].name);
      file = file.replace(/\$\[default_bio]/g, lang.profile.defaults.bio);
      file = file.replace(/\$\[default_birthday]/g, lang.profile.defaults.birthday);
      file = file.replace(/\$\[default_location]/g, lang.profile.defaults.location);
      //Execute update
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
  var dbFolder = config.pathDatabase.split('/').slice(0, -1).join('/') + '/';
  //Create db folder if not exist
  if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder);
  }
  await sql.open(config.pathDatabase);
  //Get last database version
  var lastVersion = getLastVersion();
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
