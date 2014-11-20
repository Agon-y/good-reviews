module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    nodeunit: {
      all: [/*'database/test.js', */'goodreads/test.js']
    },
    concurrent: {
      target: {
        tasks: ['nodemon', 'watch'],
        options: {
          logConcurrentOutput: true
        }
      }
    },
    copy: {
      main: {
        files : [
          { expand: true, 
            flatten: true, 
            src: ['bower_components/knockout/dist/knockout.debug.js', 
                  'bower_components/jquery/dist/jquery.js', 
                  'bower_components/lodash/dist/lodash.js', 
                  'bower_components/jquery-cookie/jquery.cookie.js',
                  'bower_components/jquery-form/jquery.form.js',
                  'bower_components/vex/js/vex.combined.min.js',
                  'public/js/progress.js',
                  'public/js/app.js',
                  'public/js/ko.loadingWhen.js',
                  'public/js/ko.components.js',], dest: 'public/tmp/js', filter: 'isFile' },
          { expand: true, 
            flatten: true, 
            src: ['public/css/app.css',
                  'bower_components/progress.js/src/progressjs.css',
                  'bower_components/vex/css/vex.css',
                  'bower_components/vex/css/vex-theme-default.css'], dest: 'public/tmp/css', filter: 'isFile' }
        ]
      }
    },
    nodemon: {
      dev: {
        script: 'app.js',
        options: {
          ignore: ['public/**'],
          watch: ['./app.js', 'goodreads/*.js', 'util/*.js', 'database/*.js']
        }
      }
    },
    watch: {
      scripts: {
        atBegin: true,
        files: ['public/js/*.js', 'public/css/*.css'],
        tasks: ['copy'],
        options: {
          spawn: false
        }
      }
    },
    execute: {
      target: {
        src: ['app.js']
      }
    }
  });

  grunt.loadNpmTasks('grunt-concurrent');

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-nodeunit');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-nodemon');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-execute');

  // Default task(s).
  grunt.registerTask('default', ['concurrent:target']);
};