var gulp = require('gulp'),
    install = require('gulp-install'),
    conflict = require('gulp-conflict'),
    template = require('gulp-template'),
    es = require('event-stream'),
    inquirer = require('inquirer'),
    rename = require('gulp-rename'),
    emptyDir = require('empty-dir'),
    tsd = require('gulp-tsd');

var destination = process.env.testDest || './';

gulp.task('default', ['generate']);

gulp.task('generate', function (done) {
  var workingDirName = process.cwd().split('/').pop().split('\\').pop();

  emptyDir('./', function (err, dirEmpty) {
    var questions = [
      {type: 'input', name: 'appname', message: 'What will your app be called?', default: workingDirName},
      {type: 'input', name: 'ts', message: 'typescript or javascript?', default: 'javascript'},
      {type: 'input', name: 'sass', message: 'sass or css?', default: 'css'}
    ];
    if (destination === './' && !dirEmpty) {
      questions.push({
        type: 'input', name: 'createDir', message: 'The current folder is not empty, do you want to create a new folder? (yes/no)', default: 'yes'
      });
    }
    inquirer.prompt(questions, function (answers) {
      if (!answers.appname) {
        return done();
      }

      answers.tsignore = '';
      answers = addPackages(answers);
      answers = cleanName(answers);

      if (answers.createDir && answers.createDir === 'yes') {
        destination = destination + answers.appname + '/';
      }

      var scriptDir = 'javascript';
      if (useTypescript(answers)) {
        scriptDir = 'typescript';
        answers.tsignore = '*.js\n**/**.js\ntypings\n!gulpfile.js\n';
      }

      gulp.src([__dirname + '/templates/' + scriptDir + '/**',
          '!' + __dirname + '/templates/' + scriptDir + '/typings',
          '!' + __dirname + '/templates/' + scriptDir + '/typings/**'])  // Note use of __dirname to be relative to generator
        .pipe(template(answers, { interpolate: /<%=([\s\S]+?)%>/g }))                 // Lodash template support
        .pipe(conflict(destination))                    // Confirms overwrites on file conflicts
        .pipe(gulp.dest(destination));                   // Without __dirname here = relative to cwd

      gulp.src(__dirname + '/templates/root/src/favicon.ico')
        .pipe(conflict(destination + 'src'))
        .pipe(gulp.dest(destination + 'src'));

      answers.sassFilter = '';
      answers.sassPipe = '';
      if (answers.sass.indexOf('sass') != -1) {
        gulp.src(__dirname + '/templates/sass/**')
          .pipe(conflict(destination + 'src'))
          .pipe(gulp.dest(destination + 'src'));

        answers.sassFilter = '\n\tvar sassFilter = gulpFilter(\'**/*.scss\', { restore: true });'
        answers.sassPipe = '\n\t\t.pipe(sassFilter)\n\t\t.pipe(require(\'gulp-sass\')())\n\t\t.pipe(sassFilter.restore)';
      } else {
        gulp.src(__dirname + '/templates/css/**')
          .pipe(conflict(destination + 'src'))
          .pipe(gulp.dest(destination + 'src'));
      }

      gulp.src([
          __dirname + '/templates/root/**',
          '!' + __dirname + '/templates/root/src/favicon.ico',
        ], { dot: true })  // Note use of __dirname to be relative to generator
        .pipe(template(answers))                 // Lodash template support
        .pipe(rename(function(path) {
          if (path.basename === '.npmignore') {
            path.basename = '.gitignore';
          }
        }))
        .pipe(conflict(destination))                    // Confirms overwrites on file conflicts
        .pipe(gulp.dest(destination))                   // Without __dirname here = relative to cwd
        .pipe(install())                      // Run `bower install` and/or `npm install` if necessary
        .on('end', function () {
          if (useTypescript(answers)) {
            tsd({
                command: 'reinstall',
                config: destination + '/tsd.json'
            }, done);
          } else {
            done();       // Finished!
          }
        })
        .resume();
    });
  });
});

function addPackages(answers) {
  var packageDelimiter = ',\n\t\t';
  var packages = [];
  var devPackages = [];
  answers.packages = '';
  answers.devPackages = '';

  if (useTypescript(answers)) {
    devPackages.push(['gulp-typescript', '^2.9.0']);
    devPackages.push(['del', '^1.2.0']);
    devPackages.push(['typescript', '^1.6.2']);
  } else {
    devPackages.push(['reactify', '^1.1.1']);
  }

  if (answers.sass.indexOf('sass') != -1) {
    devPackages.push(['gulp-sass', '^2.0.4']);
  }

  packages.forEach(function(package, index) {
    answers.packages += packageDelimiter + '"' + package[0] + '": "' + package[1] + '"';
  });
  devPackages.forEach(function(package, index) {
    answers.devPackages += packageDelimiter + '"' + package[0] + '": "' + package[1] + '"';
  });
  return answers;
}

function useTypescript(answers) {
  return answers.ts.indexOf('typescript') != -1 ||
    answers.ts.indexOf('ts') != -1;
}

function cleanName(answers) {
  answers.appname = answers.appname.split(' ').join('-');
  return answers;
}