//Configuration file
//Please fill the fields
module.exports = {
	/*===============
		-Credentials-
	===============*/
	//The token of the bot
	botToken: '',
	//Your YouTube Data API key
	youtubeAPIKey: '',
	//Your GIPHY API key
	giphyAPIKey: '',

	/*===============
		-General-
	===============*/
	//The prefix for a command (for example $help)
	prefix: '$',
	//The locales for the localization (by default en-US or fr-FR)
	locale: '',
	//The 'game' the bot is playing (more like a status)
	status: 'Type $help',
	//List of users (id) with all permissions
	superusers: [''],

	/*===============
		-Roles-
	===============*/
	//Role name for "botMember"
	roleMember: '',
	//Role name for "botModo"
	roleModo: '',

	/*===============
		-Clear list-
	===============*/
	//List of commands to clear with "$clearlog"
	commandsToClear: [''],
	//List of users (id) to clear with "$clearlog"
	usersToClear: [''],
}
