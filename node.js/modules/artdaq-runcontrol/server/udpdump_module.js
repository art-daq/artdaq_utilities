// udpdump_module.js
// Author: Eric Flumerfelt, FNAL RSI
//
// This module allows the user to run the UDPDump and JSONDispatcher ART modules over a saved datafile
//

var emitter = require('events' ).EventEmitter;
var udpd = new emitter();

var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var dgram = require('dgram');


function startJSONListener()
{
    var server = dgram.createSocket('udp4');

    console.log("Setting up JSON listener for UDPDump module");
    server.on("error", function(err) {
	    console.log("udpdump listen server error:\n" + err.stack);
            server.close();
	});

    server.on("message", function(msg, rinfo) {;
	    var thisEvent = JSON.parse(msg);
            console.log("Dispatcher received event:" + thisEvent.event);
	    udpd.emit("message", {name:"udpdump",target:"events",method:"push",data:thisEvent});
	});

    server.on("listening", function () {
	    var address = server.address();
	    console.log("server listening " +
			address.address + ":" + address.port);
	});

    console.log("Binding Server to port " + 45555 );
    server.bind(45555);
    return server;
}

function readConfigurations( data ) {
    var confDir = __dirname + "/../../artdaq-configuration/server/";
    var confFiles = fs.readdirSync(confDir);
    //console.log(confFiles);
    var dataFiles = [];

    for(var file in confFiles) {
	if(confFiles[file].search(".xml") < 0) { continue; }
	var fileName = confDir + confFiles[file];
        var res = true;
        var config = "" + fs.readFileSync( fileName );
        
        if(!fs.existsSync(data.artdaqDir)) {
	    var matches = config.match( /<artdaqDir>(.*?)<\/artdaqDir>/i );
	    if ( matches.length > 1 && fs.existsSync(matches[1]) ) {
		data.artdaqDir = matches[1];
		udpd.emit('message', {name:"udpdump", target:"artdaqDir", data: data.artdaqDir});
	    }
        }

        if(!fs.existsSync(data.artdaqDir + '/' + data.setupScript)) {
	    matches = config.match( /<setupScript>(.*?)<\/setupScript>/i );
	    if ( matches.length > 1 && fs.existsSync(data.artdaqDir + '/' + matches[1])) {
		data.setupScript = matches[1];
		udpd.emit('message', {name:"udpdump", target:"setupScript", data: data.setupScript});
	    }
        }

        matches = config.match( /<dataDir>(.*?)<\/dataDir>/i );
        if ( matches.length > 1 ) {
	    var dataDirFiles = fs.readdirSync(matches[1]);
	    for(var fileIdx in dataDirFiles) {
		if(dataDirFiles[fileIdx].search(".root") > 0) {
		    dataFiles.push(matches[1] + '/' + dataDirFiles[fileIdx]);
		}
	    }
        }
    }

    return dataFiles;
}

udpd.MasterInitFunction = function( workerData ) {
    var data = {};
    data.events = [];
    data.out = "";
    data.err = "";
    data.artPID = null;
    data.artRunning = false;
    data.artdaqDir = "/opt/otsdaqpoc/artdaq";
    data.setupScript = "setupARTDAQOTS";
    data.logTime = new Date();
    data.logTime.setTime(0);

    workerData["udpdump"] = data;
    return null;
};

udpd.WorkerInitFunction = function( workerData ) {
    startJSONListener();
    return null;
}

udpd.RW_Start = function(POST, data) {
    var fileIndex = POST.fileIndex;
    var fileNames = readConfigurations(data);
    var fileName = fileNames[fileIndex];
    data.events = [];
    udpd.emit('message', {data:data.events, name:"udpdump", target:"events"});

    var commandArray = [data.artdaqDir, data.setupScript, fileName];
        
    var out = fs.openSync( __dirname + "/../client/UDPDump.out.log",'w' );
    var err = fs.openSync( __dirname + "/../client/UDPDump.err.log",'w' );
    var system = spawn( __dirname + "/runART.sh",commandArray,{ detached: true, stdio: ['ignore',out,err] } );
    data.artPID = system.pid;
    system.unref( );
    data.artRunning = true;
    console.log( "Command Spawned" );
    udpd.emit('message', {data:data.artPID, target: "artPID", name:"udpdump"});
    udpd.emit('message', {data:data.artRunning,target: "artRunning", name:"udpdump"});
    return {out:"", err:"", running:true};
}

function checkArt( data ) {
    if ( data.artPID !== null ) {
        try {
            process.kill( data.artPID,0 );
            data.artRunning = true;
        } catch ( err ) {
            data.artRunning = false;
            data.artPID = null;
        }
    } else {
        data.artRunning = false;
    }
    udpd.emit('message', {data:data.artRunning, name:"udpdump", target:"artRunning"});
    udpd.emit('message', {data:data.artPID, name:"udpdump", target:"artPID"});
}

udpd.RW_Kill = function(POST, data) {
    checkArt(data);
    if ( data.artPID !== null ) {
	process.kill( data.artPID, 15);
	setTimeout(function(){process.kill(data.artPID, 9);}, 1000);
    }
}

udpd.RO_GetEvent = function( POST, data) {
    var events = data.events;
    if(events[0]) {
	console.log("First event in buffer: " + events[0].event + ", last event in buffer: " + events[events.length - 1].event + ", Requested event: " + POST.event + ", Event Count: " + events.length);

	if(POST.event == 0 || POST.event < events[0].event) {
	    var evtdata = events[0];
	    console.log("Sending client event " + events[0].event);
	    evtdata.lastEvent = events[events.length - 1].event;
	    return JSON.stringify(evtdata);
	} else {
	    if(events.length > events[events.length -1].event - events[0].event + 1) {
		events.sort(function(a,b) { return a.event - b.event; });
	    }

	    for(var event in events) {
		if(events[event].event == POST.event) {
		    console.log("Sending client event " + events[event].event);
		    var evtdata = events[event];
		    evtdata.lastEvent = events[events.length - 1].event;
		    return JSON.stringify(evtdata);
		}
	    }
	    if(POST.event < events[events.length -1 ].event) {
		console.log("Returning ENOEVT");
		return "ENOEVT";
	    }
	}
    }
    
    return "";
}

udpd.GET_FileNames = function(data) {
    var filePaths = readConfigurations(data);
    var fileNames = [];
    console.log(filePaths);
    for(var fpath in filePaths) {
        var name = path.basename(filePaths[fpath]);
	fileNames.push("<option value=\""+ name + "\">" + name + "</option>");
    }
    return fileNames;
}

//udpd.RW_GetEvent = function(POST, data){ return udpd.RO_GetEvent(POST, data); }

udpd.GET_Log = function(data) {
    checkArt(data);

    if( new Date(data.logTime).getTime() + 800 < new Date().getTime()) {
	data.logTime = new Date();
	if(fs.existsSync(__dirname + "/../client/UDPDump.out.log")) {
	    data.out = "" + fs.readFileSync( __dirname + "/../client/UDPDump.out.log", {encoding:'utf8'});
	}
	if(fs.existsSync(__dirname + "/../client/UDPDump.err.log")) {
	    data.err = "" + fs.readFileSync( __dirname + "/../client/UDPDump.err.log", {encoding:'utf8'});
	}
	udpd.emit("message", {name:"udpdump", data:data.out, target:"out"});
	udpd.emit("message", {name:"udpdump", data:data.err, target:"err"});
    }
    return {out:data.out, err:data.err,running:data.artRunning};
}

module.exports = function ( module_holder ) {
    module_holder["udpdump"] = udpd;
};
