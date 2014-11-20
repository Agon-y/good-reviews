var fs = require('fs'),
  moment = require('moment'),
  EventEmitter = new (require('events')).EventEmitter();

function clearLog() {
  if (fs.existsSync(__dirname + '/test.log'))
    fs.unlinkSync(__dirname + '/test.log');
}

function log(content) {
  var text = content;
  if (typeof text === 'object')
    text = JSON.stringify(text);

  console.log(text);
  fs.appendFileSync(__dirname + "/test.log", '\n\n' + moment().format() + '\n\n' + text);
}

function logError(e) {
  log(e); 
  throw e;
}

var bus = new function() {
  var self = this;

  self.on = EventEmitter.on;
  self.emit = EventEmitter.emit;
}

exports.log = log;
exports.logError = logError;
exports.clearLog = clearLog;
exports.bus = bus;