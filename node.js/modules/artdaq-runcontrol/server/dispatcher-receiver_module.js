// dispatcher-receiver_module.js
// Author: Eric Flumerfelt, FNAL RSI
//
// This module receives UDP broadcast packets from the JSONDispatcher class in artdaq-demo
//

var dgram = require('dgram');
var emitter = require('events').EventEmitter;
var arc = new emitter();

function startJSONListener(workerData, partition)
{
    var server = dgram.createSocket('udp4');

    console.log("Setting up JSON listener for partition " + partition);
    server.on("error", function(err) {
	    console.log("artdaq-runcontrol listen server error:\n" + err.stack);
            server.close();
	});

    server.on("message", function(msg, rinfo) {;
	    var thisEvent = JSON.parse(msg);
            //console.log("Dispatcher received event:" + thisEvent.event)
	    arc.emit("message", {name:"artdaq-runcontrol",target:"p"+partition+"onmon",data:true});
	    arc.emit("message", {name:"artdaq-runcontrol",target:"p"+partition+"evt",method:"push",data:thisEvent});
	});

    server.on("listening", function () {
	    var address = server.address();
	    console.log("server listening " +
			address.address + ":" + address.port);
	});

    console.log("Binding Server to port " + (35555 + partition) );
    server.bind(35555 + partition);
    return server;
}

arc.MasterInitFunction = function( workerData ) {
    return null;
};

arc.WorkerInitFunction = function( workerData ) {
    startJSONListener(workerData, 0);
    startJSONListener(workerData, 1);
    startJSONListener(workerData, 2);
    startJSONListener(workerData, 3);
    return null;
}

module.exports = function ( module_holder ) {
    module_holder["dispatcher-receiver"] = arc;
};
