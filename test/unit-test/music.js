/*eslint no-underscore-dangle: "off"*/
const expect = require('chai').expect;
const sinon = require('sinon');
const rewire = require('rewire');
const mustache = require('mustache');
const lang = require('../../localization/en-US.json');
const testUtil = require('../test-resources/test-util.js');
const { printMsg, msgSend } = testUtil;
const youtube = require('../test-resources/test-youtube.js');
var testMessages = require('../test-resources/test-messages.js');
var msg = testMessages.msg1;

const audioPlayer = rewire('../../src/modules/music/audio-player.js');

module.exports = function() {
  describe('Test the audio player', function() {
    //Setup
    let videoId
    var oldVoiceChannel = msg.member.voiceChannel
    var oldGetVideoInfo = audioPlayer.__get__('getVideoInfo');
    audioPlayer.__set__({
      get: function(url) {
        //Remove start of url
        url = url.split('https://www.googleapis.com/youtube/v3/')[1].split('?');
        //Seperate other values
        url = url.concat(url[1].split('&'));
        url.splice(1, 1);
        if (url[0] == 'search') {
          var tag = url[2].split('q=')[1];
          if (tag == 'noResults') {
            return {
              items: []
            }
          }
          return youtube.search(tag);
        } else if (url[0] == 'videos') {
          var id = url[2].split('id=')[1];
          if (id == 'unavailable123') {
            return {
              items: []
            }
          }
          return youtube.videos(id);
        }
      },
      getVideoInfo: function(msg, video) {
        videoId = video;
      }
    });
    var downloadVideo = sinon.stub(audioPlayer, 'downloadVideo');
    downloadVideo.returnsArg(0);
    //Test beginning
    describe('Test playYoutube', function() {
      it('Should return wrong usage', function() {
        audioPlayer.playYoutube(msg, '');
        expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.usage);
      });
      it('Should return missing voiceChannel', function() {
        msg.member.voiceChannel = undefined;
        audioPlayer.playYoutube(msg, ['pet']);
        expect(printMsg.lastCall.returnValue).to.equal(lang.error.notFound.voiceChannel);
      });
      it('Should return a video with a test tag', async function() {
        msg.member.voiceChannel = oldVoiceChannel;
        await audioPlayer.playYoutube(msg, ['test']);
        expect(videoId).to.equal('test123');
      });
      it('Should return not found if no video found', async function() {
        await audioPlayer.playYoutube(msg, ['noResults']);
        expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.notFound.video);
      });
      it('Should return video ID of the url', async function() {
        await audioPlayer.playYoutube(msg, ['https://www.youtube.com/watch?v=jNQXAC9IVRw']);
        expect(videoId).to.equal('jNQXAC9IVRw');
      });
    });
    describe('Test getQueue', function() {
      it('Should create a new queue and return it', function() {
        var response = audioPlayer.__get__('getQueue')('1');
        expect(response.id).to.equal('1');
      });
      it('Should return the first queue', function() {
        //Create another queue
        audioPlayer.__get__('getQueue')('2');
        var response = audioPlayer.__get__('getQueue')('1');
        expect(response.id).to.equal('1');
      });
    });
    var guildQueue = audioPlayer.__get__('getQueue')(msg.guild.id);
    describe('Test getVideoInfo', function() {
      it('Should return a video', async function() {
        await oldGetVideoInfo(msg, 'CylLNY-WSJw');
        expect(guildQueue.queue[0].id).to.equal('CylLNY-WSJw');
      });
      it('Should return an error when the video unavailable', async function() {
        await oldGetVideoInfo(msg, 'unavailable123');
        expect(msgSend.lastCall.returnValue.content).to.equal(lang.play.unavailable);
      });
    });
    describe('Test addToQueue', function() {
      it('Should join a channel and start playing', async function() {
        //Clear the queue
        guildQueue.queue = [];
        var video = {
          id: 'test123',
          title: 'test123',
          duration: '3M'
        }
        await guildQueue.addToQueue(msg, video);
        expect(guildQueue.queue[0].id).to.equal('test123');
        expect(guildQueue.connection).to.exist;
      });
      it('Should put the next video in queue', async function() {
        var video = {
          id: 'test1234',
          title: 'test1234',
          duration: '3M'
        }
        await guildQueue.addToQueue(msg, video);
        expect(guildQueue.queue[1].id).to.equal('test1234');
        expect(msgSend.lastCall.returnValue.content).to.equal(mustache.render(lang.play.added, video));
      })
    });
    describe('Test playQueue', function() {
      it('Should play the next video', function() {
        guildQueue.connection.dispatcher.end();
        expect(guildQueue.connection).to.exist;
      });
      it('Should leave the channel after playing the last video', function() {
        guildQueue.connection.dispatcher.end();
        expect(guildQueue.connection).to.equal(undefined);
      });
    });
    describe('Test stop', function() {
      it('Should return not playing anything', function() {
        msg.content = '$stop';
        new audioPlayer.StopCommand().execute(msg, ['']);
        expect(printMsg.lastCall.returnValue).to.equal(lang.error.notPlaying);
      });
      it('Should disconnect from voice channel', function() {
        guildQueue.connection = {
          disconnect: function() {
            return;
          }
        };
        new audioPlayer.StopCommand().execute(msg, ['']);
        expect(guildQueue.connection).to.equal(undefined);
        expect(printMsg.lastCall.returnValue).to.equal(lang.play.disconnected);
      });
    });
    describe('Test skip', function() {
      it('Should return not playing anything', function() {
        msg.content = '$skip';
        new audioPlayer.SkipCommand().execute(msg, ['']);
        expect(printMsg.lastCall.returnValue).to.equal(lang.error.notPlaying);
      });
      it('Should skip the video playing', async function() {
        //Setup
        guildQueue.queue = [{
          id: 'test',
          title: 'This is a test!',
          duration: '3M'
        }, {
          id: 'test2',
          title: 'This is a test!',
          duration: '3M'
        }];
        await guildQueue.addToQueue(msg, {
          id: 'test3',
          title: 'This is a test!',
          duration: '3M'
        });
        //Real testing
        new audioPlayer.SkipCommand().execute(msg, ['']);
        expect(guildQueue.queue[0].id).to.equal('test2');
        expect(printMsg.lastCall.returnValue).to.equal(lang.play.skipped);
      });
    });
    describe('Test listQueue', function() {
      it('Should send empty queue', function() {
        guildQueue.queue = [];
        msg.content = '$queue';
        new audioPlayer.QueueCommand().execute(msg, ['']);
        expect(msgSend.lastCall.returnValue.content).to.equal(lang.error.notPlaying);
      });
      it('Should send queue only for current video playing', function() {
        guildQueue.queue = [{
          id: 'test',
          title: 'test',
          duration: '3M'
        }];
        new audioPlayer.QueueCommand().execute(msg, ['']);
        expect(msgSend.lastCall.returnValue.content).to.equal('**Playing:** :notes: ```css\ntest ~ [3M]\n```');
      });
      it('Should send queue for 4 videos', function() {
        //Set the videos
        guildQueue.queue = guildQueue.queue.concat([{
          id: 'test2',
          title: 'test2',
          duration: '3M'
        }, {
          id: 'test3',
          title: 'test3',
          duration: '3M'
        }, {
          id: 'test4',
          title: 'test4',
          duration: '3M'
        }]);
        new audioPlayer.QueueCommand().execute(msg, ['']);
        expect(msgSend.lastCall.returnValue.content).to.equal(
          '**Playing:** :notes: ```css' +
          '\ntest ~ [3M]' +
          '\n```**In queue:** :notepad_spiral:```css' +
          '\n1. test2 ~ [3M]' +
          '\n2. test3 ~ [3M]' +
          '\n3. test4 ~ [3M]```');
      });
      it('Should send only the first 20 videos (+ the one playing)', function() {
        guildQueue.queue = [];
        //Add lot of videos
        for (var i = 0; i < 25; i++) {
          guildQueue.queue.push({
            id: 'test' + i,
            title: 'test' + i,
            duration: '3M'
          });
        }
        new audioPlayer.QueueCommand().execute(msg, ['']);
        expect(msgSend.lastCall.returnValue.content).to.equal(
          '**Playing:** :notes: ```css' +
          '\ntest0 ~ [3M]' +
          '\n```**In queue:** :notepad_spiral:```css' +
          '\n1. test1 ~ [3M]\n2. test2 ~ [3M]\n3. test3 ~ [3M]\n4. test4 ~ [3M]' +
          '\n5. test5 ~ [3M]\n6. test6 ~ [3M]\n7. test7 ~ [3M]\n8. test8 ~ [3M]' +
          '\n9. test9 ~ [3M]\n10. test10 ~ [3M]\n11. test11 ~ [3M]\n12. test12 ~ [3M]' +
          '\n13. test13 ~ [3M]\n14. test14 ~ [3M]\n15. test15 ~ [3M]\n16. test16 ~ [3M]' +
          '\n17. test17 ~ [3M]\n18. test18 ~ [3M]\n19. test19 ~ [3M]\n20. test20 ~ [3M]```');
      });
    });
  });
}
