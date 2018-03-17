const Discord = require("discord.js");
var deletedMessages = [];

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
    },
    fetchMessages: async function(args) {
      var predefinedMsg = [{
        content: 'Hello',
        author: {
          id: '1'
        }
      }, {
        content: '$ping',
        author: {
          id: '1'
        }
      }, {
        content: 'this',
        author: {
          id: 'testID'
        }
      }, {
        content: '$info',
        author: {
          id: '1'
        }
      }, {
        content: 'is',
        author: {
          id: '1'
        }
      }, {
        content: '$help help',
        author: {
          id: '1'
        }
      }, {
        content: 'a',
        author: {
          id: 'testID'
        }
      }, {
        content: '$profile',
        author: {
          id: '1'
        }
      }, {
        content: 'test',
        author: {
          id: '1'
        }
      }];
      var returnedMsg = []
      for(var i = 0; i < args.limit; i++) {
        if(i > predefinedMsg.length - 1) break;
        predefinedMsg[i].delete = function() {
          deletedMessages.push(this.content);
        }
        returnedMsg[i] = predefinedMsg[i]
      }
      var returnedCollection = new Discord.Collection;
      returnedCollection.array = function() {
        return returnedMsg;
      }
      return returnedCollection;
    }
  },
  mentions: {
    users: new Discord.Collection,
    roles: new Discord.Collection
  },
}
