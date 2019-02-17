const expect = require('chai').expect;
const lang = require('../../localization/en-US.json');
const mustache = require('mustache');
const db = require('../../src/modules/database/database.js');
const { replaceDatabase } = require('../test-resources/test-util.js');
const testUtil = require('../test-resources/test-util.js');
const { printMsg } = testUtil;
var config = require('../../src/util.js').getConfig()[1];
var testMessages = require('../test-resources/test-messages.js');
var msg = testMessages.msg1;

const levels = require('../../src/levels.js');

module.exports = function() {
  describe('Test getXpForLevel', function() {
    it('Should return 100 XP for level 1', async function() {
      var response = await levels.getXpForLevel(1);
      expect(response).to.equal(100);
    });
    it('Should return 155 XP for level 15', async function() {
      var response = await levels.getXpForLevel(15);
      expect(response).to.equal(155);
    });
    it('Should return 1495 XP for level 125', async function() {
      var response = await levels.getXpForLevel(125);
      expect(response).to.equal(1495);
    });
  });
  describe('Test getProgression', function() {
    it('Should returns the result of 115 XP', function() {
      var response = levels.getProgression(115);
      expect(response).to.deep.equal([2, 15, 2]);
    });
    it('Should returns the result of 420 XP', function() {
      var response = levels.getProgression(420);
      expect(response).to.deep.equal([5, 10, 5]);
    });
    it('Should returns the result of 123456 XP', function() {
      var response = levels.getProgression(123456);
      expect(response).to.deep.equal([72, 681, 272]);
    });
    it('Should returns the result of 3141592 XP', function() {
      var response = levels.getProgression(3141592);
      expect(response).to.deep.equal([0, 0, 1000]);
    });
  });
  describe('Test getRank', function() {
    it('Should return Warrior, 0 prestige (level 26)', function() {
      var response = levels.getRank(26);
      expect(response).to.deep.equal(['Warrior', 0, 16724787]);
    });
    it('Should return Vagabond, 1 prestige (level 100)', function() {
      var response = levels.getRank(100);
      expect(response).to.deep.equal(['Vagabond', 1, 8421504]);
    });
    it('Should return Vagabond, 1 prestige (level 350)', function() {
      var response = levels.getRank(350);
      expect(response).to.deep.equal(['Emperor', 3, 9181951]);
    });
    it('Should return Vagabond, 1 prestige (level 1000)', function() {
      var response = levels.getRank(1000);
      expect(response).to.deep.equal(['Vagabond', 10, 8421504]);
    });
  });
  describe('Test newMessage', function() {
    before(function() {
      msg.content = 'test';
      msg.author.id = '2'
      msg.guild.id = '1';
    });
    beforeEach(async function() {
      await replaceDatabase(config.pathDatabase, 'data1.db');
      msg.guild.roles.clear();
      msg.member.roles.clear();
      //Remove cooldown
      levels.lastMessages = [];
    });
    it('User should have more than 0 XP', async function() {
      await levels.newMessage(msg);
      var xp = await db.user.getXP(msg.guild.id, msg.author.id);
      expect(xp).to.be.above(0);
    });
    it('XP should not augment if spamming', async function() {
      //Setup cooldown
      levels.lastMessages = [{
        author: msg.author.id,
        time: Date.now()
      }];
      for (var i = 0; i < 5; i++) {
        await levels.newMessage(msg);
      }
      var xp = await db.user.getXP(msg.guild.id, msg.author.id);
      expect(xp).to.be.equal(0);
    });
    it('XP should augment if cooldown expired', async function() {
      //Setup cooldown
      levels.lastMessages = [{
        author: msg.author.id,
        time: Date.now() - 5000
      }];
      await levels.newMessage(msg);
      var xp = await db.user.getXP(msg.guild.id, msg.author.id);
      expect(xp).to.be.above(0);
    });
    it('Should return that the user has leveled up', async function() {
      await db.user.updateXP(msg.guild.id, msg.author.id, 99);
      await levels.newMessage(msg);
      expect(printMsg.lastCall.returnValue).to.equal(mustache.render(lang.general.member.leveled, {
        msg,
        progression: 2
      }));
    });
    it('Should return that the user ranked up', async function() {
      await db.user.updateXP(msg.guild.id, msg.author.id, 989);
      await levels.newMessage(msg);
      //Just one big expect to test if the returned value is correct
      expect(printMsg.lastCall.returnValue).to.equal(mustache.render(lang.general.member.leveled, {
          msg,
          progression: 10
        }) + '\n' +
        mustache.render(lang.general.member.rankUp, {
          rank: 'Farmer'
        }) + '!');
    });
    it('Should set the reward for the user (permission group)', async function() {
      //Set the reward for warrior
      await db.reward.updateRankReward(msg.guild.id, 'Warrior', 'Mod');
      await db.user.updateXP(msg.guild.id, msg.author.id, 2529);
      await levels.newMessage(msg);
      var response = await db.user.getPermGroups(msg.guild.id, msg.author.id);
      expect(response).to.equal('Member,Mod');
    })
    it('Should set the reward for the user (role)', async function() {
      await db.user.updateXP(msg.guild.id, msg.author.id, 11684);
      //Add roles
      msg.guild.roles.set('2', {
        id: '2',
        name: 'guildMember'
      });
      //Set the reward for emperor
      await db.reward.updateRankReward(msg.guild.id, 'Emperor', '2');
      await levels.newMessage(msg);
      expect(msg.member.roles.has('2')).to.equal(true);
    });
    it('Should set the reward for the user (role) and remove old one', async function() {
      await db.user.updateXP(msg.guild.id, msg.author.id, 11684);
      //Add roles for guild
      msg.guild.roles.set('2', {
        id: '2',
        name: 'guildMember'
      });
      msg.guild.roles.set('3', {
        id: '3',
        name: 'guildSuperMember'
      });
      //Add roles for user
      msg.member.roles.set('2', {
        id: '2',
        name: 'guildMember'
      });
      //Test if user has the group
      expect(msg.member.roles.has('2')).to.equal(true);
      //Set the reward for king
      await db.reward.updateRankReward(msg.guild.id, 'King', '2');
      //Set the reward for emperor
      await db.reward.updateRankReward(msg.guild.id, 'Emperor', '3');
      await levels.newMessage(msg);
      //Test user's groups
      expect(msg.member.roles.has('2')).to.equal(false);
      expect(msg.member.roles.has('3')).to.equal(true);
    });
  });
}
