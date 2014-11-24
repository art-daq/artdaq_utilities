// procstat.js : Cat /proc/stat
// Author: Eric Flumerfelt, FNAL RSI
// Last Modified: October 29, 2014
// Modified By: Eric Flumerfelt
//
// procstat.js simply reads the /proc/stat file, and returns the data

// Node.js framework "includes"
var fs = require('fs');
var emitter = require('events').EventEmitter;
var procstat = new emitter();

// Only function here...read the file
procstat.readfile = function () {
  fs.readFile('/proc/stat', function read(err, data) {
    if(err) throw err;
    // HTML-ize and send the data
    procstat.emit('procfile',("<p>" + data + "</p>").replace(/(\r|\n)/g, "<br>"));
  });
}

module.exports = procstat;
