// artdaq-runcontrol_module.js
// Author: Eric Flumerfelt, FNAL RSI
// Modified: December 30, 2014
//
// This module implements a basic Run Control system for the artdaq-demo
//

var spawn = require( 'child_process' ).spawn;
var emitter = require( 'events' ).EventEmitter;
var fs = require( 'fs' );
var arc = new emitter( );

// System Status
var Status = function ( partition ) {
    this.state = "Shutdown";
    this.runNumber = 1000;
    this.systemPID = null;
    this.systemRunning = false;
    this.systemOutputBuffer = "";
    this.systemErrorBuffer = "";
    this.commandPID = null;
    this.commandRunning = false;
    this.commandOutputBuffer = "";
    this.commandErrorBuffer = "";
    this.stopPending = false;
    this.WFPlotsUpdated = Date.now( );
    this.WFFileSize = 0;
    this.WFFileMtime = 0;
    this.partition = partition;
    this.config = "";
};

var configuration = {};
configuration.artdaqDir = "~/artdaq-demo-base";
configuration.setupScript = "setupARTDAQDEMO";
configuration.runValue = 0;

function readConfiguration( systemStatus ) {
    var fileName = __dirname + "/../../artdaq-configuration/server/" + systemStatus.config;
    console.log( "Going to read configuration " + fileName );
    if ( fs.existsSync( fileName ) ) {
        var res = true;
        var config = "" + fs.readFileSync( fileName );
        
        var matches = config.match( /<artdaqDir>(.*?)<\/artdaqDir>/i );
        if ( matches.length > 1 ) {
            configuration.artdaqDir = matches[1];
        } else {
            console.log( "ARTDAQ Dir not found!" );
            res = false;
        }
        
        matches = config.match( /<setupScript>(.*?)<\/setupScript>/i );
        if ( matches.length > 1 ) {
            configuration.setupScript = matches[1];
        } else {
            console.log( "Setup script not found!" );
            res = false;
        }
        
        matches = config.match( /<runValue>(.*?)<\/runValue>/i );
        if ( matches.length > 1 ) {
            configuration.runValue = parseInt( matches[1] );
        } else {
            console.log( "Run Value not found!" );
            res = false;
        }
        return res;
    }
    console.log( "Configuration file not found!" );
    return false;
}

arc.MasterInitFunction = function ( workerData ) {
    var output = {};
    output.p0 = new Status( 0 );
    output.p1 = new Status( 1 );
    output.p2 = new Status( 2 );
    output.p3 = new Status( 3 );
    
    if ( !fs.existsSync( __dirname + "/../client/P0" ) ) {
        fs.mkdirSync( __dirname + "/../client/P0" );
    }
    if ( !fs.existsSync( __dirname + "/../client/P1" ) ) {
        fs.mkdirSync( __dirname + "/../client/P1" );
    }
    if ( !fs.existsSync( __dirname + "/../client/P2" ) ) {
        fs.mkdirSync( __dirname + "/../client/P2" );
    }
    if ( !fs.existsSync( __dirname + "/../client/P3" ) ) {
        fs.mkdirSync( __dirname + "/../client/P3" );
    }
    
    fs.chmodSync( __dirname + "/runARTDAQ.sh",'777' );
    fs.chmodSync( __dirname + "/killArtdaq.sh",'777' );
    fs.chmodSync( __dirname + "/cleanupArtdaq.sh",'777' );
    
    workerData["artdaq-runcontrol"] = output;
};

function checkCommand( systemStatus ) {
    if ( systemStatus.commandPID !== null ) {
        try {
            process.kill( systemStatus.commandPID,0 );
            systemStatus.commandRunning = true;
        } catch ( err ) {
            systemStatus.commandRunning = false;
            systemStatus.commandPID = null;
        }
    } else {
        systemStatus.commandRunning = false;
    }
}

function checkSystem( systemStatus ) {
    if ( systemStatus.systemPID !== null ) {
        try {
            process.kill( systemStatus.systemPID,0 );
            systemStatus.systemRunning = true;
        } catch ( err ) {
            systemStatus.systemRunning = false;
            systemStatus.systemPID = null;
        }
    } else {
        systemStatus.systemRunning = false;
    }
}

function startCommand( args,systemStatus ) {
    if ( readConfiguration( systemStatus ) ) {
        var port = ( systemStatus.partition * 100 ) + 5600;
        var configName = configuration.artdaqDir + "/P" + systemStatus.partition + "Config.xml";
        var commandArray = [systemStatus.config,configName,port,"manageSystem.sh", "-C", configName].concat( args );
        systemStatus.commandErrorBuffer = "";
        systemStatus.commandOutputBuffer = "";
        var out = fs.openSync( __dirname + "/../client/P" + systemStatus.partition + "/comm.out.log",'w' );
        var err = fs.openSync( __dirname + "/../client/P" + systemStatus.partition + "/comm.err.log",'w' );
        console.log( "Spawning: " + __dirname + "/runARTDAQ.sh " + commandArray );
        var command = spawn( __dirname + "/runARTDAQ.sh",commandArray,{ detached: true, stdio: ['ignore',out,err] } );
        systemStatus.commandPID = command.pid;
        command.unref( );
        systemStatus.commandRunning = true;
        checkCommand( systemStatus );
    } else {
        console.log( "CANNOT READ CONFIGURATION. COMMAND NOT STARTED!!!!" );
    }
}

function startSystem( systemStatus ) {
    if ( readConfiguration( systemStatus ) ) {
        console.log( "Starting System, Partition " + systemStatus.partition );
        var port = ( systemStatus.partition * 100 ) + 5600;
        var configName = configuration.artdaqDir + "/P" + systemStatus.partition + "Config.xml";
        
        var commandArray = [systemStatus.config, configName,port,"startSystem.sh","-c",configName];
        
        var out = fs.openSync( __dirname + "/../client/P" + systemStatus.partition + "/out.log",'w' );
        var err = fs.openSync( __dirname + "/../client/P" + systemStatus.partition + "/err.log",'w' );
        systemStatus.systemErrorBuffer = "";
        systemStatus.systemOutputBuffer = "";
        console.log( "Spawning: " + __dirname + "/runARTDAQ.sh " + commandArray.join( ' ' ) );
        var system = spawn( __dirname + "/runARTDAQ.sh",commandArray,{ detached: true, stdio: ['ignore',out,err] } );
        systemStatus.systemPID = system.pid;
        system.unref( );
        systemStatus.systemRunning = true;
        console.log( "Command Spawned" );
        
        systemStatus.state = "Started";
    } else {
        console.log( "CANNOT READ CONFIGURATION. COMMAND NOT STARTED!!!!" );
    }
}

function initialize( systemStatus ) {
    if ( systemStatus.commandRunning ) {
        setTimeout( function () { initialize( systemStatus ); } );
    }
    else {
        var onmonDir = __dirname + "/../client/P" + systemStatus.partition;
        
        var args = ["-M",onmonDir,"init"];
        startCommand( args,systemStatus );
        systemStatus.state = "Initialized";
    }
}

function startRun( systemStatus ) {
    if ( systemStatus.commandRunning ) {
        setTimeout( function () { startRun( systemStatus ); },500 );
    }
    else {
        var args = ["-N",systemStatus.runNumber,"start"];
        startCommand( args,systemStatus );
        systemStatus.state = "Running";
        if ( readConfiguration( systemStatus ) && configuration.runValue > 0 ) {
            systemStatus.stopPending = true;
            startCommand( ["stop"],systemStatus );
        }
    }
}

function pauseRun( systemStatus ) {
    if ( systemStatus.commandRunning ) {
        setTimeout( function () { pauseRun( systemStatus ); },500 );
    }
    else {
        var args = ["pause"];
        startCommand( args,systemStatus );
        systemStatus.state = "Paused";
    }
}

function resumeRun( systemStatus ) {
    if ( systemStatus.commandRunning ) {
        setTimeout( function () { resumeRun( systemStatus ); },500 );
    }
    else {
        var args = ["resume"];
        startCommand( args,systemStatus );
        systemStatus.state = "Running";
    }
}

function endRun( systemStatus ) {
    if ( systemStatus.commandRunning ) {
        setTimeout( function () { endRun( systemStatus ); },500 );
    }
    else {
        var args = ["stop"];
        startCommand( args,systemStatus );
        systemStatus.state = "Initialized";
    }
}

function killSystem( systemStatus ) {
    checkCommand( systemStatus );
    if ( !systemStatus.commandRunning ) {
        checkSystem( systemStatus );
        if ( systemStatus.systemRunning ) {
            console.log( "Killing System, PID: " + systemStatus.systemPID );
            spawn( __dirname + '/killArtdaq.sh',[systemStatus.systemPID] );
            setTimeout( function () { killSystem( systemStatus ); },1000 );
        }
    } else {
        console.log( "Command running, spinning..." );
        setTimeout( function () { killSystem( systemStatus ); },1000 );
    }
}

function shutdownSystem( systemStatus ) {
    if ( systemStatus.commandRunning ) {
        setTimeout( function () { shutdownSystem( systemStatus ); },500 );
    }
    else {
        console.log( "Shutting down system, Partition " + systemStatus.partition );
        var args = ["shutdown"];
        startCommand( args,systemStatus );
        spawn( __dirname + '/cleanupArtdaq.sh',[__dirname,systemStatus.partition] );
        systemStatus.state = "Shutdown";
    }
    
    setTimeout( function () { killSystem( systemStatus ); },4000 );
}

function getStatus( systemStatuses,partition ) {
    var systemStatus = systemStatuses["p" + partition];
    checkCommand( systemStatus );
    checkSystem( systemStatus );
    if ( fs.existsSync( __dirname + "/../client/P" + systemStatus.partition + "/artdaqdemo_onmon.root" ) ) {
        var stats = fs.statSync( __dirname + "/../client/P" + systemStatus.partition + "/artdaqdemo_onmon.root" );
        var statSize = stats.size;
        if ( statSize !== systemStatus.WFFileSize ) {
            systemStatus.WFFileSize = statSize;
            systemStatus.WFPlotsUpdated = Date.now( );
            console.log( "Plots Updated at " + systemStatus.WFPlotsUpdated );
        }
        if ( stats.mtime - systemStatus.WFFileMtime ) {
            systemStatus.WFFileMtime = stats.mtime;
            systemStatus.WFPlotsUpdated = Date.now( );
            console.log( "Plots Updated at " + systemStatus.WFPlotsUpdated );
        }
    } else {
        systemStatus.WFPlotsUpdated = null;
    }
    if ( fs.existsSync( __dirname + "/../client/P" + systemStatus.partition + "/out.log" ) ) {
        systemStatus.systemOutputBuffer = "" + fs.readFileSync( __dirname + "/../client/P" + systemStatus.partition + "/out.log" );
    }
    if ( fs.existsSync( __dirname + "/../client/P" + systemStatus.partition + "/err.log" ) ) {
        systemStatus.systemErrorBuffer = "" + fs.readFileSync( __dirname + "/../client/P" + systemStatus.partition + "/err.log" );
    }
    if ( fs.existsSync( __dirname + "/../client/P" + systemStatus.partition + "/comm.out.log" ) ) {
        systemStatus.commandOutputBuffer = "" + fs.readFileSync( __dirname + "/../client/P" + systemStatus.partition + "/comm.out.log" );
    }
    if ( fs.existsSync( __dirname + "/../client/P" + systemStatus.partition + "/comm.err.log" ) ) {
        systemStatus.commandErrorBuffer = "" + fs.readFileSync( __dirname + "/../client/P" + systemStatus.partition + "/comm.err.log" );
    }
    if ( systemStatus.stopPending && !systemStatus.commandRunning ) {
        systemStatus.state = "Initialized";
    }
    arc.emit( 'end',JSON.stringify( systemStatus ) );
}

arc.GET_P0 = function ( systemStatuses ) {
    getStatus( systemStatuses,0 );
};

arc.GET_P1 = function ( systemStatuses ) {
    getStatus( systemStatuses,1 );
};

arc.GET_P2 = function ( systemStatuses ) {
    getStatus( systemStatuses,2 );
};

arc.GET_P3 = function ( systemStatuses ) {
    getStatus( systemStatuses,3 );
};

arc.RW_Start = function ( POST,systemStatuses ) {
    systemStatuses["p" + POST.partition].config = POST.config;
    if ( systemStatuses["p" + POST.partition].state === "Shutdown" ) {
        startSystem( systemStatuses["p" + POST.partition] );
    }
    getStatus( systemStatuses,POST.partition );
};

arc.RW_Init = function ( POST,systemStatuses ) {
    systemStatuses["p" + POST.partition].config = POST.config;
    if ( systemStatuses["p" + POST.partition].state === "Started" ) {
        initialize( systemStatuses["p" + POST.partition] );
    }
    getStatus( systemStatuses,POST.partition );
};

arc.RW_Run = function ( POST,systemStatuses ) {
    systemStatuses["p" + POST.partition].config = POST.config;
    systemStatuses["p" + POST.partition].runNumber = POST.runNumber;
    if ( systemStatuses["p" + POST.partition].state === "Initialized" ) {
        startRun( systemStatuses["p" + POST.partition] );
    }
    getStatus( systemStatuses,POST.partition );
};

arc.RW_Pause = function ( POST,systemStatuses ) {
    systemStatuses["p" + POST.partition].config = POST.config;
    if ( systemStatuses["p" + POST.partition].state === "Running" ) {
        pauseRun( systemStatuses["p" + POST.partition] );
    }
    getStatus( systemStatuses,POST.partition );
};

arc.RW_Resume = function ( POST,systemStatuses ) {
    systemStatuses["p" + POST.partition].config = POST.config;
    if ( systemStatuses["p" + POST.partition].state === "Paused" ) {
        resumeRun( systemStatuses["p" + POST.partition] );
    }
    getStatus( systemStatuses,POST.partition );
};

arc.RW_End = function ( POST,systemStatuses ) {
    systemStatuses["p" + POST.partition].config = POST.config;
    if ( systemStatuses["p" + POST.partition].state === "Running" || systemStatuses["p" + POST.partition].state === "Paused" ) {
        endRun( systemStatuses["p" + POST.partition] );
    }
    getStatus( systemStatuses,POST.partition );
};

arc.RW_Shutdown = function ( POST,systemStatuses ) {
    systemStatuses["p" + POST.partition].config = POST.config;
    if ( systemStatuses["p" + POST.partition].state === "Started" || systemStatuses["p" + POST.partition].state === "Initialized" || systemStatuses["p" + POST.partition].state === "Paused" ) {
        shutdownSystem( systemStatuses["p" + POST.partition] );
    }
    getStatus( systemStatuses,POST.partition );
};

module.exports = function ( module_holder ) {
    module_holder["artdaq-runcontrol"] = arc;
};
