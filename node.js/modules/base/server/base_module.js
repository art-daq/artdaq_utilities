// Base_module.js : Server-side utilities module
// Author: Eric Flumerfelt, FNAL RSI
// Modified: December 23, 2014
//
// Currently Contains:
//  -- GET_ReadLog: Read the serverbase.js server.log
// Client-side ajax-loader.gif from http://www.ajaxload.info/

// Node.js "includes"
var spawn = require('child_process').spawn;
var emitter = require('events').EventEmitter;

var base = new emitter();

base.MasterInitFunction = function () { return null; };
base.WorkerInitFunction = function () { return null; };

base.GET_ReadLog = function () {
    console.log("Reading " + (__dirname + "/../../../server.log"));
    var tail = spawn("tail", ["-1000", __dirname + "/../../../server.log"]);
    tail.stdout.on('data', function (data) {
        base.emit('data', data.toString());
    });
    tail.on('close', function (code) {
        base.emit('end', "");
    });
}

module.exports = function (module_holder) {
    module_holder["base"] = base;
};