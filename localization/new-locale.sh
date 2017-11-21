#!/bin/bash
while true; do
    read -p "Have you read the README? (y/n)" yn
    case $yn in
        [Yy]* )
          read -p "Type the name of your locale file (format: language-territory)" name
          cp -n en-US.json $name.json; break;;
        [Nn]* ) exit;;
        * ) echo "Please answer yes or no.";;
    esac
done
