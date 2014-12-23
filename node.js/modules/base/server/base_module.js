// Base_module.js : Server-side utilities module
// Author: Eric Flumerfelt, FNAL RSI
// Modified: December 23, 2014
//
// Currently Contains:
//  -- GET_ReadLog: Read the serverbase.js server.log


// Node.js "includes"
var fs = require('fs');
var emitter = require('events').EventEmitter;

var base = new emitter();

base.MasterInitFunction = function () {

};

base.GET_ReadLog = function () {
    console.log("Reading " + (__dirname + "/../../../server.log"));
    fs.readFile(__dirname + "/../../../server.log", function (err, data) {
        if (err) throw err;
        base.emit('end', data);
    });
}

module.exports = function (module_holder) {
    module_holder["base"] = base;
};