exports.msg1 = {
  content: '$help',
  author: {
    username: 'User'
  },
  reply: function(text) {
    return text;
  },
  channel: {
    send: function(text) {
      return text;
    }
  }
}
