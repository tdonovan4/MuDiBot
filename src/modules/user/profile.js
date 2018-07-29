const Discord = require("discord.js");
const mustache = require('mustache');
const commands = require('../../commands.js');
const db = require('../database/database.js');
const levels = require('../../levels.js');
var config = require('../../util.js').getConfig()[1];
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
    if (this.value != undefined) {
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
    for (var condition of this.conditions) {
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
      msg.channel.send(lang.modifyprofile.modified);
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
  ProfileCommand: class extends commands.Command {
    constructor() {
      super({
        name: 'profile',
        aliases: [],
        args: [
          new commands.Argument({
            optional: true,
            type: 'mention',
            invalidError: lang.error.invalidArg.user
          })
        ],
        category: 'user',
        priority: 10,
        permLvl: 0
      });
    }
    async execute(msg) {
      //Start measuring time
      var start = process.hrtime();

      let user = msg.mentions.users.first();
      if (user == undefined) {
        //There is no mentions
        user = msg.author;
      }

      let userData = await db.user.getAll(msg.guild.id, user.id);
      if (userData == null) {
        /*eslint-disable camelcase*/
        //User doesn't exist, using default
        userData = {};
        userData.xp = 0;
        userData.warning = 0;
        userData.permission_group = config.groups[0].name;
        userData.bio = lang.profile.defaults.bio;
        userData.birthday = lang.profile.defaults.birthday;
        userData.location = lang.profile.defaults.location;
        /*eslint-enable camelcase*/
      }

      //Get groups
      var groups = userData.permission_group;
      if (groups != null) {
        groups = groups.split(',').sort(function(a, b) {
          //Sorting by order of permission level
          return config.groups.find(x => x.name == a).permLvl <
            config.groups.find(x => x.name == b).permLvl;
        });
        //If user is a superuser, add that to groups
        if (config.superusers.find(x => x == user.id) != null) {
          groups.unshift('Superuser');
        }
        //Put newline at every 2 groups
        for (let i = 2; i < groups.length; i += 2) {
          groups[i] = '\n' + groups[i];
        }
        groups = groups.join(', ');
      } else {
        //Default
        groups = config.groups[0].name;
      }

      let localPos = await db.leaderboard.getUserLocalPos(msg.guild.id, user.id);
      let localProgression = levels.getProgression(userData.xp);
      let localLevel = localProgression[0];
      let localXPToNextLevel = `${localProgression[1]}/${levels.getXpForLevel(localLevel)}`;
      let localRank = levels.getRank(localProgression[2]);

      var embed = new Discord.RichEmbed();
      embed.title = mustache.render(lang.profile.title, user);
      embed.color = localRank[2];
      embed.setThumbnail(user.avatarURL)
      //Basic info: bio, birthday, location, and account creation time
      embed.addField(lang.profile.basicInfo.name,
        //Bio
        `${lang.profile.basicInfo.bio} \`\`\`${userData.bio}\`\`\`` +
        //Birthday
        `\n${lang.profile.basicInfo.birthday} ${userData.birthday}` +
        //Location
        ` | ${lang.profile.basicInfo.location} ${userData.location}` +
        //Account creation
        `\n${lang.profile.basicInfo.accountCreation} ` +
        `${user.createdAt.toISOString().slice(0, 10)}`
      );
      //Local experience
      embed.addField(lang.profile.xp.local,
        //Rank
        `${lang.profile.xp.rank} ${localRank[0]}` +
        `${(localRank[1] > 0) ? `(${localRank[1]}:star:)` : ''}` +
        //Position
        `\n${lang.profile.xp.position} #${localPos}` +
        //Level
        `\n${lang.profile.xp.level} ${localLevel} (${localXPToNextLevel})` +
        //Total XP
        `\n${lang.profile.xp.totalXP} ${userData.xp}`,
        //Inline
        true
      );
      //Global experience
      let globalPos = await db.leaderboard.getUserGlobalPos(user.id);
      let globalXP = await db.user.getSumXP(user.id);
      let globalProgression = levels.getProgression(globalXP);
      let globalLevel = globalProgression[0];
      let globalXPToNextLevel = `${globalProgression[1]}/${levels.getXpForLevel(globalLevel)}`;
      let globalRank = levels.getRank(globalProgression[2]);
      embed.addField(lang.profile.xp.global,
        //Rank
        `${lang.profile.xp.rank} ${globalRank[0]}` +
        `${(globalRank[1] > 0) ? `(${globalRank[1]}:star:)` : ''}` +
        //Position
        `\n${lang.profile.xp.position} #${globalPos}` +
        //Level
        `\n${lang.profile.xp.level} ${globalLevel} (${globalXPToNextLevel})` +
        //Total XP
        `\n${lang.profile.xp.totalXP} ${globalXP}`,
        //Inline
        true
      );
      //Permission groups
      embed.addField(lang.profile.groups, groups, true);
      //Warnings
      embed.addField(lang.profile.warnings, userData.warning, true);
      //Time it took
      var end = process.hrtime(start);
      var took = end[0] * 1000 + end[1] / 1000000;
      //Footer
      embed.setFooter(mustache.render(lang.profile.footer, {
        id: user.id,
        time: took.toFixed(2)
      }));
      msg.channel.send({
        embed
      });
    }
  },
  ModifyProfileCommand: class extends commands.Command {
    constructor() {
      super({
        name: 'modifyprofile',
        aliases: [],
        args: [
          new commands.Argument({
            optional: false,
            interactiveMsg: lang.modifyprofile.interactiveMode.field,
            possibleValues: ['bio', 'birthday', 'location'],
            missingError: lang.error.missingArg.field,
            invalidError: lang.error.invalidArg.field
          }),
          new commands.Argument({
            optional: false,
            interactiveMsg: lang.modifyprofile.interactiveMode.value,
            missingError: lang.error.missingArg.value
          })
        ],
        category: 'user',
        priority: 9,
        permLvl: 0
      });
    }
    async execute(msg, args) {
      var field = profileFields.get(args[0].toLowerCase());
      //Add input to db
      await field.updateDB(msg, args.slice(1).join(' '));
    }
  }
}
