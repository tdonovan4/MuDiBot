Here are all the locales for the localization.

You can add a new one by executing new-locale.sh or new-locale.bat, you will then need to localize it.

##How to localize:
###Guidelines
* Only translate the value. The value is the part after the `:`. In `"msg": "Pong!"`, it would be "Pong!". Do not translate the part before the `:`!

* Do not remove/change special characters like `*` or `_`.

* Do not touch template. A template is this `{{user}}`, it will be replaced by a value. You can only move it to make sense with the sentence.

###Example:
For simple text:
```json
"language": "Selected language: English"
```
becomes
```json
"language": "Langue sélectionnée: français"
```

For text with a template:
```json
"title": "{{username}}'s profile"
```
becomes
```json
"Profit de {{username}}",
```
