/**
TEST_PAUSE:

- load test page
- for each stream:
    - load stream
    - check if <video> is playing
    - wait for N seconds
    - repeat N times:
        - pause the player (OrangeHasPlayer.pause())
        - check if <video> is paused
        - check if <video> is not progressing
        - resume the player (OrangeHasPlayer.play())
        - check if <video> is playing
**/

define([
    'intern!object',
    'intern/chai!assert',
    'require',
    'test/functional/config/testsConfig',
    'test/functional/tests/player_functions',
    'test/functional/tests/video_functions',
    'test/functional/tests/tests_functions'
], function(registerSuite, assert, require, config, player, video, tests) {

    // Suite name
    var NAME = 'TEST_PAUSE';

    // Test configuration (see config/testConfig.js)
    var testConfig = config.tests.pause,
        streams = tests.getTestStreams(config.tests.pause, function(stream) {
            if (stream.type === 'VOD') {
                return true;
            }
            return false;
        });

    // Test constants
    var PROGRESS_DELAY = 5; // Delay for checking progressing (in s)
    var ASYNC_TIMEOUT = PROGRESS_DELAY + config.asyncTimeout; // Asynchronous timeout for checking progressing
    var PAUSE_DELAY = 5; // Delay (in s) for checking is player is still paused (= not prgressing)

    // Test variables
    var command = null,
        i, j;

    var testSetup = function(stream) {
        registerSuite({
            name: NAME,

            setup: function() {
                tests.log(NAME, 'Setup');
                command = this.remote.get(require.toUrl(config.testPage));
                command = tests.setup(command);
                return command;
            },

            play: function() {
                tests.logLoadStream(NAME, stream);
                return command.execute(player.loadStream, [stream])
                    .then(function() {
                        tests.log(NAME, 'Check if playing');
                        return tests.executeAsync(command, video.isPlaying, [PROGRESS_DELAY], ASYNC_TIMEOUT);
                    })
                    .then(function(playing) {
                        assert.isTrue(playing);
                    });
            }
        });
    };

    var test = function() {

        registerSuite({
            name: NAME,

            pause: function() {
                var currentTime = 0;
                var sleepTime = Math.round(Math.random() * 20);

                tests.log(NAME, 'Wait ' + sleepTime + ' sec. and pause the player');
                return command.sleep(sleepTime * 1000).execute(player.pause)
                    .then(function() {
                        tests.log(NAME, 'Check if paused');
                        return command.execute(video.isPaused);
                    })
                    .then(function(paused) {
                        assert.isTrue(paused);
                        return command.execute(video.getCurrentTime);
                    })
                    .then(function(time) {
                        currentTime = time;
                        tests.log(NAME, 'Check if not progressing');
                        tests.log(NAME, 'Current time = ' + time);
                        return command.sleep(PAUSE_DELAY * 1000);
                    })
                    .then(function() {
                        return command.execute(video.getCurrentTime);
                    })
                    .then(function(time) {
                        tests.log(NAME, 'Current time = ' + time);
                        assert.strictEqual(time, currentTime);
                        tests.log(NAME, 'Resume the player');
                        return command.execute(player.play);
                    })
                    .then(function() {
                        tests.log(NAME, 'Check if playing');
                        return tests.executeAsync(command, video.isPlaying, [PROGRESS_DELAY], ASYNC_TIMEOUT);
                    })
                    .then(function(playing) {
                        assert.isTrue(playing);
                    });
            }
        });
    };


    for (i = 0; i < streams.length; i++) {

        // setup: load test page and stream
        testSetup(streams[i]);

        // Performs pause tests
        for (j = 0; j < testConfig.pauseCount; j++) {
            test();
        }
    }

});
