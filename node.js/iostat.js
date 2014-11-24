// iostat.js : Run IOStat command
// Author: Eric Flumerfelt, FNAL RSI
// Last Modified: October 29, 2014
// Modified By: Eric Flumerfelt
//

// Node.js framework "includes"
var spawn = require('child_process').spawn;
var emitter = require('events').EventEmitter;
var iostatem = new emitter();

// The function which runs "iostat"
iostatem.iostat = function () {
  var iostat = spawn('iostat');

  // Emit data events whenever stdout or stderr are written
  iostat.stdout.on('data',function (data) {
    iostatem.emit('data',data);
  });

  // Emit data events whenever stdout or stderr are written
  iostat.stderr.on('data', function (data) {
    iostatem.emit('data',data);
  });

  // When the program is done, return the status code
  iostat.on('close',function (code) {
    iostatem.emit('iostat', code);
  });
}

module.exports = iostatem;
