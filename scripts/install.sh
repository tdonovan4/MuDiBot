#!/bin/bash
if [$OSTYPE == "win32"]; then
  echo "This script does not support Windows"
  exit
fi

#Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit
fi

echo "This script will install dependencies for the bot to run if they are not already on your system."
echo "These dependencies include libtool, autoconf and multiple npm packages."

function install() {
  directory=$PWD
  if ! [ -x "$(command -v libtool)" ]; then
    # Install libtool
    cd /usr/local/src
    wget http://mirror.jre655.com/GNU/libtool/libtool-2.4.6.tar.gz
    tar xf libtool*
    cd libtool-2.4.6
    sh configure --prefix /usr/local
    make install
  else
    echo "Libtool already installed, skipping"
  fi
  if ! [ -x "$(command -v autoconf)" ]; then
    # Install autoconf
    cd /usr/local/src
    wget http://ftp.gnu.org/gnu/autoconf/autoconf-2.69.tar.gz
    tar xf autoconf*
    cd autoconf-2.69
    sh configure --prefix /usr/local
    make install
  else
    echo "Autoconf already installed, skipping"
  fi
  if ! [ -x "$(command -v automake)" ]; then
    # Install automake
    cd /usr/local/src
    wget http://ftp.gnu.org/gnu/automake/automake-1.16.tar.gz
    tar xf automake*
    cd automake-1.16
    sh configure --prefix /usr/local
    make install
  else
    echo "Automake already installed, skipping"
  fi
  cd $directory
  # Install npm dependencies
  sudo npm install
}

#Prompt user
while true; do
    read -p "Do you want to continue? [Y/n]: " yn
    case $yn in
        [Yy]* )
          install
          exit;;
        [Nn]* ) exit;;
        * )
          echo "Wrong input, cancelling"
          exit;;
    esac
done
