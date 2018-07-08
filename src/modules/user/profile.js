const Discord = require("discord.js");
const bot = require('../../bot.js');
const db = require('../database/database.js');
const levels = require('../../levels.js');
const mustache = require('mustache');
var config = require('../../args.js').getConfig()[1];
var lang = require('../../localization.js').getLocalization();

class Condition {
  constructor(name, value, error) {
    this.name = name;
    this.value = value;
    //The error to throw if the input don't pass the conditon
    this.rejectionError = error;
  }
}

class MaxCharLengthCondition extends Condition {
  constructor(maxCharLength) {
    super('maxCharLength',
      maxCharLength,
      mustache.render(lang.error.tooMuch.chars, {
        max: maxCharLength
      }));
  }
  validate(input) {
    /*
     * If a maximum character limit is set,
     * check the number of characters of
     * the input and return false if too big
     */
    return this.value == undefined ||
      input.length <= this.value;
  }
}

class FormatCondition extends Condition {
  constructor(regex) {
    super('format',
    regex,
    lang.error.formatError);
  }
  validate(input) {
    var result = true;
    if(this.value != undefined) {
      //Test the input against the provided regex
      result = this.value.test(input);
    }
    return result
  }
}

class ProfileField {
  constructor(name, req) {
    /*
     * The name of the field, used in
     * the command to find which column
     * in the database too change.
     */
    this.name = name;
    //Conditions used to validate the input
    this.conditions = [
      //The maximum amount of characters for the input
      new MaxCharLengthCondition(req.maxCharLength),
      //The format of the input using regex
      new FormatCondition(req.format)
    ]
  }
  isInputValid(msg, input) {
    var isValid = true;
    //Check each conditions to make sure the input is valid
    for(var condition of this.conditions) {
      var result = condition.validate(input);
      if (result === false) {
        //If one condition failed, the input is not valid
        isValid = false;
        //Print the error
        msg.channel.send(condition.rejectionError);
        break;
      }
    }
    return isValid;
  }
}

//The user profile customizable fields
var profileFields = new Map();
//Set the fields
profileFields.set('bio', new ProfileField('bio', {
  maxCharLength: 280
}));
profileFields.set('birthday', new ProfileField('birthday', {
  format: /([0-9]{4}|-)(-[0-9]{2}){2}/
}));
profileFields.set('location', new ProfileField('location', {}));

module.exports = {
  ProfileCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'profile',
        aliases: [],
        category: 'user',
        priority: 10,
        permLvl: 0
      });
    }
    async execute(msg) {
      let user = msg.mentions.users.first();
      if (user == undefined) {
        //There is no mentions
        user = msg.author;
      }

      let userData = await db.user.getAll(msg.guild.id, user.id);
      let progression = levels.getProgression(userData.xp);
      let level = progression[0];
      let xpToNextLevel = `${progression[1]}/${levels.getXpForLevel(level)}`;
      let rank = levels.getRank(progression[2]);
      let groups = ['Ø'];

      //Get groups
      if (userData.permission_group != null) {
        groups = userData.permission_group.split(',').sort(function(a, b) {
          return config.groups.find(x => x.name == a).permLvl <
            config.groups.find(x => x.name == b).permLvl;
        });
      }

      //If user is a superuser, add that to groups
      if (config.superusers.find(x => x == user.id) != null) {
        groups.unshift('Superuser');
      }

      //Put newline at every 4 groups
      for (let i = 3; i < groups.length; i += 3) {
        groups[i] = '\n' + groups[i];
      }

      var embed = new Discord.RichEmbed();
      embed.title = mustache.render(lang.profile.title, user);
      embed.color = rank[2];
      embed.setThumbnail(user.avatarURL)
      embed.addField(lang.profile.rank,
        `${rank[0]} ${(rank[1] > 0) ? `(${rank[1]}:star:)` : ''}`, true)
      embed.addField(lang.profile.groups, groups.join(', '), true)
      embed.addField(lang.profile.level, `${level} (${xpToNextLevel})`, false)
      embed.addField(lang.profile.xp, userData.xp, true)
      embed.addField(lang.profile.warnings, userData.warning, true)
      embed.setFooter(mustache.render(lang.profile.footer, user))
      msg.channel.send({
        embed
      });
    }
  },
  ModifyProfileCommand: class extends bot.Command {
    constructor() {
      super({
        name: 'modifyprofile',
        aliases: [],
        category: 'user',
        priority: 9,
        permLvl: 0
      });
    }
    execute(msg, args) {
      //Check args
      if(args.length < 2) {
        if(args.length < 1) {
          //No field
          bot.printMsg(msg, lang.error.missingArg.field);
        } else {
          //No value
          bot.printMsg(msg, lang.error.missingArg.value);
        }
        return;
      }
      //Check input
      var isInputValid = profileFields.get(args[0]).isInputValid(msg, args[1]);
      if (isInputValid) {
        //TODO: Add to database
      }
    }
  }
}
