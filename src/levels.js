const storage = require('./storage.js');
const bot = require('./bot.js');

function getXpForLevel(level) {
  return 10*(level)+75;
}

function getProgression(remainingXp) {
  level = 0;
  while(remainingXp > getXpForLevel(level)) {
    remainingXp -= getXpForLevel(level);
    level++;
  }
  return [level, remainingXp];
}

module.exports = {
  newMessage: async function (msg) {
    var xp = await storage.getUser(msg, msg.author.id);
    xp = xp.xp;
    if(xp != undefined) {
      //Add 1 per 2 characters
      var extraXp = Math.trunc(msg.content.replace(/\s/g, "").length/3);
      //Get a random number from 1 to 3 and add extra xp (max is 20);
      xpGained = Math.min(20, (Math.floor(Math.random() * 3) + 1) + extraXp);
      storage.modifyUser(msg, msg.author.id, 'xp', xp + xpGained);

      let progression = getProgression(xp);
      let xpForNextLevel = getXpForLevel(progression[0]) - progression[1];

      //Check if user has level up
      if(xpGained > xpForNextLevel) {
        //Level up!
        bot.printMsg(msg, `You just leveled up to level ${progression[0]+1}!`);
      }
    }
  }
}
