var expect = require('chai').expect;
const Discord = require('discord.js');
const client = new Discord.Client();
var config = require('../src/args.js').getConfig();

describe('Startup tests', function() {
  describe('Token', function() {
    it('Should login if token is present', async() => {
      const login = await client.login(config.botToken)
      expect(login).to.equal(config.botToken)
    });
  });
});
