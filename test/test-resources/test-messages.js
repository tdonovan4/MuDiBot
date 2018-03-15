const Discord = require("discord.js");

exports.msg1 = {
  content: '$help',
  author: {
    username: 'TestUser',
    id: '041025599435591424'
  },
  member: {
    addRole: function(role, reason) {
      return new Promise(resolve => {
        this.roles.set(role, {
          id: 2
        })
        resolve()
      });
    },
    permissions: new Discord.Collection,
    roles: new Discord.Collection
  },
  guild: {
    id: '357156661105365963',
    roles: new Discord.Collection,
    members: {
      get: function(id) {
        var username = 'TestUser';
        if(id == '357156661105365963') {
          username = 'George'
        }
        return {
          user: {
            username: username
          }
        }
      }
    }
  },
  reply: function(text) {
    return text;
  },
  channel: {
    send: function(text) {
      return text;
    }
  },
  mentions: {
    users: new Discord.Collection,
    roles: new Discord.Collection
  }
}
