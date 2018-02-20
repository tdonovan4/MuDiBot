module.exports = {
  login: function(token) {
    return new Promise(function(resolve) {
      resolve(token != null);
    });
  },
  on: function() {
    return new Promise(function(resolve) {
      //Placeholder
      resolve(true);
    });
  },
  user: {
    id: 'testID',
    setGame: function(game) {
      return(game)
    }
  }
}
