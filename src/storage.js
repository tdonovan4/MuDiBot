const fs = require('fs');
module.exports = {
	write: function (obj) {
		var json = JSON.stringify(obj);
		
		fs.writeFile('warning-list.json', json, 'utf8', (err) => {
			if (err){ console.log(err); }
		});
	},
	
	read: function () {
		return JSON.parse(fs.readFileSync('warning-list.json', 'utf8'));
	},
	
	empty: function () {
		if(fs.readFileSync('warning-list.json', 'utf8') == '') {
			return true;
			} else {
			return false;
		}
	},
	
	exist: function () {
		if (!fs.existsSync('warning-list.json')) {
			fs.openSync('warning-list.json', 'w');
		}	
	}
}	
