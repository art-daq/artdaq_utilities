// iostat.js : Run IOStat command
// Author: Eric Flumerfelt, FNAL RSI
// Last Modified: December 23, 2014
//   Compatibility updates to work with serverbase.js v0.4
//

// Node.js framework "includes"
var spawn = require('child_process').spawn;
var emitter = require('events').EventEmitter;
var iostatem = new emitter();

iostatem.MasterInitFunction = function () { return null; };

// The function which runs "iostat"
iostatem.GET_ = function () {
  var iostat = spawn('iostat');

  // Emit data events whenever stdout or stderr are written
    iostat.stdout.on('data', function (data) {
    iostatem.emit('data',data.toString() + "\n");
  });

  // Emit data events whenever stdout or stderr are written
    iostat.stderr.on('data', function (data) {
    iostatem.emit('data',data.toString() + "\n");
  });

  // When the program is done, return the status code
    iostat.on('close', function (code) {
    iostatem.emit('end', code);
  });
}

module.exports = function (module_holder) {
    module_holder["iostat"] = iostatem;
};
