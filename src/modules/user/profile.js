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
  constructor(name, args) {
    /*
     * The name of the field, used in
     * the command to find which column
     * in the database too change.
     */
    this.name = name;
    //Make sure req is defined
    if (args.req == undefined) args.req = {};
    //Conditions used to validate the input
    this.conditions = [
      //The maximum amount of characters for the input
      new MaxCharLengthCondition(args.req.maxCharLength),
      //The format of the input using regex
      new FormatCondition(args.req.format)
    ]
    //The function to modify the row in the database
    this.dbModifyFunction = args.dbModifyFunction;
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
  async updateDB(msg, input) {
    //Check input
    if (this.isInputValid(msg, input)) {
      await this.dbModifyFunction(msg.guild.id, msg.author.id, input);
      msg.channel.send(lang.modifyProfile.modified);
    }
  }
}

//The user profile customizable fields
var profileFields = new Map();
//Set the fields
profileFields.set('bio', new ProfileField('bio', {
  req: {
    maxCharLength: 280
  },
  dbModifyFunction: db.user.updateBio
}));
profileFields.set('birthday', new ProfileField('birthday', {
  req: {
    format: /([0-9]{4}|-)(-[0-9]{2}){2}/
  },
  dbModifyFunction: db.user.updateBirthday
}));
profileFields.set('location', new ProfileField('location', {
  dbModifyFunction: db.user.updateLocation
}));

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
    async execute(msg, args) {
      //Check args
      if(args.length < 2) {
        if(args.length < 1) {
          //No field
          msg.channel.send(lang.error.missingArg.field);
        } else {
          //No value
          msg.channel.send(lang.error.missingArg.value);
        }
        return;
      }
      var field = profileFields.get(args[0].toLowerCase());
      if (field != undefined) {
        //Add input to db
        await field.updateDB(msg, args.slice(1).join(' '));
      } else {
        //Bad field
        msg.channel.send(lang.error.invalidArg.field);
      }
    }
  }
}
