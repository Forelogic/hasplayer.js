var gulp = require('gulp'),
    // node packages
    fs = require('fs-extra'),
    runSequence = require('run-sequence'),
    // gulp packages
    header = require('gulp-header'),
    concat = require('gulp-concat'),
    footer = require('gulp-footer'),
    git = require('gulp-git'),
    gulpif = require('gulp-if'),
    jsdoc = require('gulp-jsdoc3'),
    jshint = require('gulp-jshint'),
    replace = require('gulp-regexp-sourcemaps'),
    sourcemaps = require('gulp-sourcemaps'),
    uglify = require('gulp-uglify'),
    zip = require('gulp-zip'),
    // custom import
    pkg = require('../package.json'),
    sources = require('./sources.json'),
    // command line options
    argv = require('yargs')
        .default('protection', true)
        .default('mss', true)
        .default('hls', true)
        .default('name', '')
        .argv;

// Header for build file that includes copyrightand package information (version and build date)
var comment = '<%= pkg.copyright %>\n\n/* Last build : <%= pkg.gitDate %>_<%= pkg.gitTime %> / git revision : <%= pkg.gitRevision %> */\n\n';

// UMD template
var umd = fs.readFileSync("./umd.js", "utf8");
var umdHeader = umd.substring(0, umd.indexOf('//@@HASPLAYER'));
var umdFooter = umd.substring(umd.indexOf('//@@HASPLAYER') + '//@@HASPLAYER'.length);

// Jshint ignore directives for minifiled build file
var jshint_ignore_start = '/* jshint ignore:start */\n';
var jshint_ignore_end = '\n/* jshint ignore:end */';

var config = {
    distDir: '../dist',
    doc: {
        source: '../app/js/streaming/MediaPlayer.js',
        readme: '../README.md',
        errorsTable: './jsdoc/errors.html'
    },
    jsdoc: {
        'opts': {
            'destination': '../doc/jsdoc'
        },
        'templates': {
            'theme': 'united',
            'linenums': true,
            "cleverLinks": false,
            "monospaceLinks": false,
            "collapseSymbols": false
        },
        "tags": {
            "allowUnknownTags": true
        }
    }
};

var initTasks = ['clean', 'package-info', 'jshint'];
var minify = false;

// console.log('Include MSS package: ' + argv.mss);
// console.log('Include HLS package: ' + argv.hls);
// console.log('Include Protection package: ' + argv.protection);

// Create the final globs for sources according to command line options
var sourcesGlob = sources.default;

if (eval(argv.protection)) {
    sourcesGlob = sourcesGlob.concat(sources.protection);
}

if (eval(argv.hls)) {
    sourcesGlob = sourcesGlob.concat(sources.hls);
}

if (eval(argv.mss)) {
    sourcesGlob = sourcesGlob.concat(sources.mss);
}


// 'clean' task: clean output folder
gulp.task('clean', function(done) {
    return (function() {
        fs.emptyDirSync(config.distDir);
        done();
    })();
});

// 'package-info' task: get additional package information such as Git info and COPYRIGHT
gulp.task('package-info', function() {
    // Get last abbreviated commit hash
    git.exec({args: 'log -1 --format=%h', quiet: true}, function (err, stdout) {
        pkg.gitRevision = stdout.replace(/(\r\n|\n|\r)/gm,"");
    });
    // Get last commit date
    git.exec({args: 'log -1 --format=%cD', quiet: true}, function (err, stdout) {
        var date = new Date(stdout);
        pkg.gitDate = (date.getFullYear()) + '-' + (date.getMonth() + 1) + '-' + (date.getDate());
        pkg.gitTime = (date.getHours()) + ':' + (date.getMinutes()) + ':' + (date.getSeconds());
    });
    // Get COPYRIGHT
    fs.readFile('../COPYRIGHT', null, function(err, _data) {
        pkg.copyright = _data;
    });
});

// 'jshint' task: jshint code checking
gulp.task('jshint', function() {
    return gulp.src(sourcesGlob)
        .pipe(jshint())
        .pipe(jshint.reporter('jshint-stylish'));
});

// 'build' task: generate build version of the source code
gulp.task('build', function() {

    // Integrate libs after jshint code checking
    sourcesGlob = sourcesGlob.concat(sources.libs);

    // Determine build file name
    var filename = minify ? (pkg.name.replace('.js', '.min.js')) : pkg.name;

    return gulp.src(sourcesGlob, { base: '../app' })
        .pipe(sourcemaps.init())
        .pipe(concat(filename))
        .pipe(replace(/VERSION[\s*]=[\s*]['\\](.*)['\\]/g, 'VERSION = \'' + pkg.version + '\''))
        .pipe(replace(/@@TIMESTAMP/, pkg.gitDate + '_' + pkg.gitTime))
        .pipe(replace(/@@REVISION/, pkg.gitRevision))
        .pipe(header(umdHeader))
        .pipe(footer(umdFooter))
        .pipe(gulpif(minify, uglify()))
        .pipe(header(comment, {pkg: pkg}))
        .pipe(gulpif(minify, header(jshint_ignore_start)))
        .pipe(gulpif(minify, footer(jshint_ignore_end)))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(config.distDir));
});

// 'doc' task: generate jsdoc
gulp.task('doc', function() {
    // Include version in jsdoc system name
    config.jsdoc.templates.systemName = pkg.name + ' ' + pkg.version;
    return gulp.src([config.doc.readme, config.doc.source], {read: true})
        .pipe(jsdoc(config.jsdoc));
});

// 'zip' task: zip output folder contents into one zip file
gulp.task('zip', function() {
    var filename = pkg.name + '-v' + pkg.version;
    console.log(argv.name);
    if (argv.name.length > 0) {
        filename += '_' + argv.name;
    }
    filename += '.zip';
    return gulp.src(config.distDir + '/**/*')
        .pipe(zip(filename))
        .pipe(gulp.dest(config.distDir));
});

// 'build' task: build source files
gulp.task('default', initTasks, function() {
    minify = false;
    runSequence(initTasks, 'build', function() {
        // build minified version
        minify = true;
        runSequence('build');
    });
});

// 'watch' task: spy on source files
gulp.task('watch', initTasks, function() {
    gulp.watch(sourcesGlob, ['build']);
});
