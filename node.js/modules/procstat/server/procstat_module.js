// procstat.js : Cat /proc/stat
// Author: Eric Flumerfelt, FNAL RSI
// Last Modified: December 23, 2014
//   Compatibility updates to work with serverbase.js v0.4
//
// procstat.js simply reads the /proc/stat file, and returns the data

// Node.js framework "includes"
var fs = require('fs');
var emitter = require('events').EventEmitter;
var procstat = new emitter();

procstat.MasterInitFunction = function () { };

// Only function here...read the file
procstat.GET_ = function () {
  fs.readFile('/proc/stat', function read(err, data) {
    if(err) throw err;
    // HTML-ize and send the data
    procstat.emit('end',("<p>" + data + "</p>").replace(/(\r|\n)/g, "<br>"));
  });
}

module.exports = function (module_holder) {
    module_holder["procstat"] = procstat;
};
