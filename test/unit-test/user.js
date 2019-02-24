const expect = require('chai').expect;
const lang = require('../../localization/en-US.json');
const db = require('../../src/modules/database/database.js');
const sql = require('sqlite');
const Discord = require('discord.js');
const mustache = require('mustache');
const { replaceDatabase } = require('../test-resources/test-util.js');
const testUtil = require('../test-resources/test-util.js');
const { msgSend, printMsg } = testUtil;
var config = require('../../src/util.js').getConfig()[1];
var testMessages = require('../test-resources/test-messages.js');
var msg = testMessages.msg1;

const Avatar = require('../../src/modules/user/avatar.js');
const permGroups = require('../../src/modules/user/permission-group.js');
const profile = require('../../src/modules/user/profile.js');
const Top = require('../../src/modules/user/top.js');

async function insertUser(serverId, userId, xp) {
  await sql.open(config.pathDatabase);
  await sql.run('INSERT INTO user (server_id, user_id, xp, warning, permission_group) VALUES (?, ?, ?, ?, ?)', [serverId, userId, xp, 0, null]);
  await sql.close();
  //Add user to collection
  Discord.client.users.set(`${userId}`, {
    username: `The${userId}`
  });
}
async function insertUsers(serverId, num) {
  await sql.open(config.pathDatabase);
  //Add users
  var users = [];
  for (var i = 0; i < num; i++) {
    var value = i * 10;
    //Add to list
    users.push(`(${serverId}, ${i}, ${value}, ${0}, ${null})`);
    //Add user to collection
    Discord.client.users.set(`${i}`, {
      username: `The${i}`
    });
  }
  //Bulk insert
  await sql.run('INSERT INTO user (server_id, user_id, xp, warning, permission_group) VALUES ' + users.join(', '));
  await sql.close();
}

module.exports = function() {
  describe('Test avatar', function() {
    var url = 'https://cdn.discordapp.com/avatars/041025599435591424/';
    before(function() {
      msg.guild.members.set(msg.author.id, {
        id: msg.author.id,
        user: {
          avatarURL: url
        }
      });
    });
    after(function() {
      msg.guild.members.clear();
    });
    var avatarCmd = new Avatar();
    //Test args
    describe('Test arguments', function() {
      it('Should return invalid arg: user', function() {
        avatarCmd.checkArgs(msg, ['test']);
        expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.user);
      });
    });
    //Actual tests
    describe('Test execute()', function() {
      it('Should return TestUser\'s avatar', function() {
        //Add mention
        avatarCmd.execute(msg, [`<@${msg.author.id}>`]);
        expect(msgSend.lastCall.returnValue.content).to.equal(url);
      });
    });
    //Test interactive mode
    describe('Test interactive mode', function() {
      it('Should use interactive mode to get TestUser\'s avatar', async function() {
        msg.channel.messages = [
          { ...msg, ...{ content: `<@${msg.author.id}>` } }
        ];
        await avatarCmd.interactiveMode(msg);
        expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
          lang.avatar.interactiveMode.user);
        expect(msgSend.lastCall.returnValue.content).to.equal(url);
      });
    });
  });
  describe('Test the permission group submodule', function() {
    var oldGuild = msg.guild;
    before(function() {
      msg.guild.members.set('1', {
        id: 1,
        user: {
          id: 1
        }
      });
      msg.guild.members.set('2', {
        id: 2,
        user: {
          id: 2
        }
      });
      msg.guild.members.set('3', {
        id: 3,
        user: {
          id: 3
        }
      });
      msg.guild.members.set(msg.author.id, {
        id: msg.author.id,
        user: {
          id: msg.author.id
        }
      });
    });
    after(function() {
      //Reset
      msg.guild = oldGuild;
      msg.guild.members.clear();
    });
    beforeEach(async function() {
      await replaceDatabase(config.pathDatabase, 'data1.db');
    });
    //It also tests setGroup
    describe('Test setgroup command', function() {
      var setgroupCmd = new permGroups.SetGroupCommand();
      //Test Args
      describe('Test arguments', function() {
        it('Should return invalid user', function() {
          setgroupCmd.checkArgs(msg, ['test']);
          expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.user);
        });
        it('Should return missing argument: group', function() {
          setgroupCmd.checkArgs(msg, ['<@1>']);
          expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.missingArg.group);
        });
        it('Should return group not found', function() {
          setgroupCmd.checkArgs(msg, ['<@1>', 'qwerty']);
          expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.notFound.group);
        });
      });
      //Real tests
      describe('Test execute()', function() {
        it('Should add "User" to the list of groups of TestUser', async function() {
          await setgroupCmd.execute(msg, [`<@!${msg.author.id}>`, 'User']);
          var response = await db.user.getPermGroups(msg.guild.id, msg.author.id);
          expect(response).to.equal('User');
        });
        it('Should add "Member" to the list of groups of TestUser', async function() {
          await setgroupCmd.execute(msg, [`<@!${msg.author.id}>`, 'Member']);
          var response = await db.user.getPermGroups(msg.guild.id, msg.author.id);
          expect(response).to.equal('User,Member');
        });
      });
      //Test interactive mode
      describe('Test interactive mode', function() {
        it('Should use interactive mode to add "Mod" to TestUser', async function() {
          msg.channel.messages = [
            { ...msg, ...{ content: `<@${msg.author.id}>` } },
            { ...msg, ...{ content: 'Mod' } }
          ];
          await setgroupCmd.interactiveMode(msg);
          expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
            lang.setgroup.interactiveMode.user);
          expect(msgSend.lastCall.returnValue.content).to.equal(
            lang.setgroup.interactiveMode.group);
          var response = await db.user.getPermGroups(msg.guild.id, msg.author.id);
          expect(response).to.equal('User,Mod');
        });
      });
    });
    describe('Test unsetGroup', function() {
      var unsetgroupCmd = new permGroups.UnsetGroupCommand();
      //Test args
      describe('Test arguments', function() {
        it('Should return invalid user', function() {
          unsetgroupCmd.checkArgs(msg, ['test']);
          expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.user);
        });
        it('Should return missing argument: group', function() {
          unsetgroupCmd.checkArgs(msg, ['<@1>']);
          expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.missingArg.group);
        });
        it('Should return group not found', function() {
          unsetgroupCmd.checkArgs(msg, ['<@1>', 'qwerty']);
          expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.notFound.group);
        });
      });
      //Real tests
      describe('Test execute()', function() {
        it('Should remove "Member" from the list of groups of user 2', async function() {
          msg.guild.id = '1';
          await unsetgroupCmd.execute(msg, ['<@!2>', 'Member']);
          var response = await db.user.getPermGroups('1', '2');
          expect(response).to.equal('');
        });
        it('Should remove "User" from the list of groups of user 3', async function() {
          msg.guild.id = '3';
          await unsetgroupCmd.execute(msg, ['<@!3>', 'User']);
          var response = await db.user.getPermGroups('3', '3');
          expect(response).to.equal('Member');
        });
        it('Should return that the user is not in this group', async function() {
          await unsetgroupCmd.execute(msg, [`<@!${msg.author.id}>`, 'Admin']);
          expect(printMsg.lastCall.returnValue).to.equal(lang.unsetgroup.notInGroup);
        })
      });
      //Test interactive mode
      describe('Test interactive mode', function() {
        it('Should use interactive mode to remove "Mod" from user 1', async function() {
          msg.guild.id = '2';
          msg.channel.messages = [
            { ...msg, ...{ content: '<@!1>' } },
            { ...msg, ...{ content: 'Mod' } }
          ];
          await unsetgroupCmd.interactiveMode(msg);
          expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
            lang.setgroup.interactiveMode.user);
          expect(msgSend.lastCall.returnValue.content).to.equal(
            lang.setgroup.interactiveMode.group);
        });
      });
    });
    describe('Test purgeGroups', function() {
      var purgeGroupsCmd = new permGroups.PurgeGroupsCommand();
      beforeEach(function() {
        msg.mentions.users.clear();
      });
      after(function() {
        msg.mentions.users.clear();
      });
      //Test args
      describe('Test arguments', function() {
        it('Should return invalid user', function() {
          purgeGroupsCmd.checkArgs(msg, ['test']);
          expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.invalidArg.user);
        });
      });
      //Real tests
      describe('Test execute()', function() {
        it('Should purge user 3\'s groups', async function() {
          msg.guild.id = '3';
          msg.mentions.users.set('3', {
            id: '3'
          });
          await purgeGroupsCmd.execute(msg, ['<@!3>']);
          var response = await db.user.getPermGroups('3', '3');
          expect(response).to.equal('User');
        })
      });
      //Test interactive mode
      describe('Test interactive mode', function() {
        it('Should use interactive mode to purge user 1\'s groups', async function() {
          msg.channel.messages = [
            { ...msg, ...{ content: '<@!1>' } }
          ];
          await purgeGroupsCmd.interactiveMode(msg);
          expect(msgSend.lastCall.returnValue.content).to.equal(
            lang.setgroup.interactiveMode.user);
          var response = await db.user.getPermGroups(msg.guild.id, msg.author.id);
          expect(response).to.equal('User');
        });
      });
    });
  });
  describe('Test the profile submodule', function() {
    describe('Test profile command', function() {
      var profileCmd = new profile.ProfileCommand();
      beforeEach(async function() {
        await replaceDatabase(config.pathDatabase, 'data3.db');
      });
      after(function() {
        msg.mentions.users.clear();
        //Reset
        config.superusers = [];
      });
      describe('Test execute()', function() {
        it('Should return the message author\'s (TestUser) profile', async function() {
          msg.guild.id = '3';
          await profileCmd.execute(msg, []);
          var embed = msgSend.lastCall.returnValue.content.embed;
          expect(embed.title).to.equal('TestUser\'s profile');
          expect(embed.fields[0].value).to.equal('**Bio:** ```This user doesn\'t ' +
            'have a bio!```\n**Birthday:** Unknown | **Location:** Unknown\n' +
            '**Account created since:** 2009-12-24');
          expect(embed.fields[1].value).to.equal('Rank: Emperor\n' +
            'Position: #1\nLevel: 50 (0/450)\nTotal XP: 11685');
          expect(embed.fields[2].value).to.equal('Rank: XP Master\n' +
            'Position: #1\nLevel: 66 (358/635)\nTotal XP: 20593');
          expect(embed.fields[3].value).to.equal('Member, User');
          expect(embed.fields[4].value).to.equal('0');
          expect(embed.footer).to.exist;
        });
        it('Should add superuser to list of permission groups', async function() {
          config.superusers = ['041025599435591424'];
          await profileCmd.execute(msg, []);
          var embed = msgSend.lastCall.returnValue.content.embed;
          expect(embed.fields[3].value).to.equal('Superuser, Member, \nUser');
        });
        it('Should add bio, birthday, and location', async function() {
          msg.guild.id = '4';
          msg.content = '$profile';
          await profileCmd.execute(msg, []);
          var embed = msgSend.lastCall.returnValue.content.embed;
          expect(embed.fields[0].value).to.equal('**Bio:** ```Test bio```\n' +
            '**Birthday:** --02-01 | **Location:** There\n' +
            '**Account created since:** 2009-12-24');
        });
        it('Should return George\'s profile', async function() {
          msg.guild.id = '3';
          var id = '357156661105365963';
          //Add mention
          msg.mentions.users.set(id, {
            id: id,
            username: 'George',
            createdAt: new Date(1985, 10, 16)
          });
          msg.content = `$profile <#${id}>`;
          await profileCmd.execute(msg, [`<#${id}>`])
          var embed = msgSend.lastCall.returnValue.content.embed;
          expect(embed.fields[0].value).to.equal('**Bio:** ```This user doesn\'t ' +
            'have a bio!```\n**Birthday:** Unknown | **Location:** Unknown\n' +
            '**Account created since:** 1985-11-16');
          expect(embed.fields[1].value).to.equal('Rank: Vagabond\n' +
            'Position: #2\nLevel: 1 (0/100)\nTotal XP: 0');
          expect(embed.fields[2].value).to.equal('Rank: Vagabond\n' +
            'Position: #2\nLevel: 1 (0/100)\nTotal XP: 0');
          expect(embed.fields[3].value).to.equal('User');
          expect(embed.fields[4].value).to.equal('0');
          expect(embed.footer).to.exist;
        });
      });
    });
    describe('Test modifyprofile command', function() {
      var modifyProfileCmd = new profile.ModifyProfileCommand();
      describe('Test bad arguments', function() {
        it('Should return invalid field', function() {
          modifyProfileCmd.checkArgs(msg, ['test']);
          var result = msgSend.lastCall.returnValue.content;
          expect(result).to.equal(lang.error.invalidArg.field);
        });
        it('Should return missing argument value', function() {
          modifyProfileCmd.checkArgs(msg, ['bio']);
          var result = msgSend.lastCall.returnValue.content;
          expect(result).to.equal(lang.error.missingArg.value);
        });
        it('Should return invalid argument field', function() {
          modifyProfileCmd.checkArgs(msg, ['test', 'test']);
          var result = msgSend.lastCall.returnValue.content;
          expect(result).to.equal(lang.error.invalidArg.field);
        });
      });
      describe('Test validation of input', function() {
        it('The bio field should return that there is too much chars', async function() {
          var args = ('bio Lorem ipsum dolor sit amet, ' +
            'nostrud civibus mel ne, eu sea nostrud epicurei urbanitas, ' +
            'eam ex sonet repudiare. Ex debet tation cum, ex qui graeci ' +
            'senserit definiebas, sint dolorem definitionem eam ne. ' +
            'Eum doctus impedit prodesset ad, habeo justo dicunt te est. ' +
            'Vel eruditi eligendi imperdiet et, mea no dolor propriae deseruisse. ' +
            'Reque populo maluisset ne has, has decore ullamcorper ad, ' +
            'commodo iracundia ea nec.').split(' ');
          await modifyProfileCmd.execute(msg, args);
          var result = msgSend.lastCall.returnValue.content;
          var response = await db.user.getAll(msg.guild.id, msg.author.id);
          expect(result).to.equal(mustache.render(lang.error.tooMuch.chars, {
            max: 280
          }));
          //Make sure the db was not modified
          expect(response.bio).to.equal('This user doesn\'t have a bio!');
        });
        it('The birthday field should return that the format is wrong', async function() {
          await modifyProfileCmd.execute(msg, ['birthday', 'test']);
          var result = msgSend.lastCall.returnValue.content;
          var response = await db.user.getAll(msg.guild.id, msg.author.id);
          expect(result).to.equal(lang.error.formatError);
          //Make sure the db was not modified
          expect(response.birthday).to.equal('Unknown');
        });
      });
      describe('Test if the command actually works', function() {
        it('Should change bio to lorem ipsum', async function() {
          await modifyProfileCmd.execute(msg, ['bio', 'lorem', 'ipsum']);
          var response = await db.user.getAll(msg.guild.id, msg.author.id);
          expect(response.bio).to.equal('lorem ipsum');
        });
        it('Should change birthday to 1971-01-01', async function() {
          await modifyProfileCmd.execute(msg, ['birthday', '1971-01-01']);
          var response = await db.user.getAll(msg.guild.id, msg.author.id);
          expect(response.birthday).to.equal('1971-01-01');
        });
        it('Should change location to there', async function() {
          await modifyProfileCmd.execute(msg, ['location', 'there']);
          var response = await db.user.getAll(msg.guild.id, msg.author.id);
          expect(response.location).to.equal('there');
        });
      });
      describe('Test interactive mode', function() {
        it('Should use interactive mode to change location to somewhere', async function() {
          msg.channel.messages = [
            { ...msg, ...{ content: 'location' } },
            { ...msg, ...{ content: 'somewhere' } }
          ];
          await modifyProfileCmd.interactiveMode(msg);
          expect(msgSend.getCall(msgSend.callCount - 3).returnValue.content).to.equal(
            lang.modifyprofile.interactiveMode.field);
          expect(msgSend.getCall(msgSend.callCount - 2).returnValue.content).to.equal(
            lang.modifyprofile.interactiveMode.value);
          expect(msgSend.lastCall.returnValue.content).to.equal(
            lang.modifyprofile.modified);
          var response = await db.user.getAll(msg.guild.id, msg.author.id);
          expect(response.location).to.equal('somewhere');
        });
      });
    });
  });
  describe('Test top', function() {
    var topCmd = new Top();
    beforeEach(async function() {
      await replaceDatabase(config.pathDatabase, 'empty.db');
    });
    it('Should return empty tops', async function() {
      await topCmd.execute(msg, []);
      var embed = msgSend.lastCall.returnValue.content;
      //Local
      expect(embed.fields[0].value).to.equal('***Total of 0 users***');
      //Global
      expect(embed.fields[1].value).to.equal('***Total of 0 users***');
    });
    it('Should return local with 1 user and global with 2 users', async function() {
      await insertUser(msg.guild.id, '01', 0);
      await insertUser('1289021', '02', 15);
      await topCmd.execute(msg, []);
      var embed = msgSend.lastCall.returnValue.content;
      //Local
      expect(embed.fields[0].value).to.equal(
        '**1. The01 🥇**\n⤷ Level: 1 | XP: 0\n***Total of 1 users***');
      //Global
      expect(embed.fields[1].value).to.equal(
        '**1. The02 🥇**\n⤷ Level: 1 | XP: 15\n**2. The01 🥈**\n⤷ Level: 1 ' +
        '| XP: 0\n***Total of 2 users***');
    });
    it('Global should merge same user', async function() {
      await insertUser('1289021', '02', 15);
      await insertUser('1289021', '01', 10);
      await topCmd.execute(msg, []);
      var embed = msgSend.lastCall.returnValue.content;
      //Local
      expect(embed.fields[0].value).to.equal(
        '***Total of 0 users***');
      //Global
      expect(embed.fields[1].value).to.equal(
        '**1. The02 🥇**\n⤷ Level: 1 | XP: 15\n**2. The01 🥈**\n⤷ Level: 1 ' +
        '| XP: 10\n***Total of 2 users***');
    });
    it('Test ordering of users', async function() {
      //Add users
      await insertUsers(msg.guild.id, 20);
      await insertUsers('2', 20);
      await topCmd.execute(msg, []);
      var embed = msgSend.lastCall.returnValue.content;
      //Local
      expect(embed.fields[0].value).to.equal(
        '**1. The19 🥇**\n⤷ Level: 2 | XP: 190\n**2. The18 🥈**\n⤷ Level: 2 ' +
        '| XP: 180\n**3. The17 🥉**\n⤷ Level: 2 | XP: 170\n**4. The16 **\n' +
        '⤷ Level: 2 | XP: 160\n**5. The15 **\n⤷ Level: 2 | XP: 150\n**6. ' +
        'The14 **\n⤷ Level: 2 | XP: 140\n**7. The13 **\n⤷ Level: 2 | XP: 130' +
        '\n**8. The12 **\n⤷ Level: 2 | XP: 120\n**9. The11 **\n⤷ Level: 2 | ' +
        'XP: 110\n**10. The10 **\n⤷ Level: 2 | XP: 100\n***Total of 20 users***');
      //Global
      expect(embed.fields[1].value).to.equal(
        '**1. The19 🥇**\n⤷ Level: 4 | XP: 380\n**2. The18 🥈**\n⤷ Level: 4 | ' +
        'XP: 360\n**3. The17 🥉**\n⤷ Level: 4 | XP: 340\n**4. The16 **\n' +
        '⤷ Level: 4 | XP: 320\n**5. The15 **\n⤷ Level: 3 | XP: 300\n**6.' +
        ' The14 **\n⤷ Level: 3 | XP: 280\n**7. The13 **\n⤷ Level: 3 | XP: 260' +
        '\n**8. The12 **\n⤷ Level: 3 | XP: 240\n**9. The11 **\n⤷ Level: 3 | ' +
        'XP: 220\n**10. The10 **\n⤷ Level: 3 | XP: 200\n***Total of 20 users***');
    });
  });
}
