//Handle writing and reading on files
const fs = require('fs');
//TODO: Add argument for path
module.exports = {
	write: function (file, obj) {
		var json = JSON.stringify(obj);
		
		fs.writeFile(file, json, 'utf8', (err) => {
			if (err){ console.log(err); }
		});
	},
	
	read: function (file) {
		return JSON.parse(fs.readFileSync(file, 'utf8'));
	},
	
	empty: function (file) {
		if(fs.readFileSync(file, 'utf8') == '') {
			return true;
			} else {
			return false;
		}
	},
	
	exist: function (file) {
		if (!fs.existsSync(file)) {
			fs.openSync(file, 'w');
		}	
	},
	
	delete: function (file) {
		fs.unlinkSync(file);
	}
}	
