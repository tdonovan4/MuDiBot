@echo off
:while1
set /p yn="Have you read the README? (y/n)"
IF "%yn%" == "Y" GOTO yes
IF "%yn%" == "y" GOTO yes
IF "%yn%" == "yes" GOTO yes
IF "%yn%" == "N" GOTO end
IF "%yn%" == "n" GOTO end
IF "%yn%" == "no" GOTO end
ECHO Please answer yes or no.
GOTO :while1

:yes
set /p name="Type the name of your locale file (format: language-territory)"
xcopy  en-US.json %name%.json*

:end
