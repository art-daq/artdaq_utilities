// artdaq-runcontrol_module.js
// Author: Eric Flumerfelt, FNAL RSI
// Modified: December 30, 2014
//
// This module implements a basic Run Control system for the artdaq-demo
//

var spawn = require('child_process').spawn;
var emitter = require('events').EventEmitter;
var fs = require('fs');
var arc = new emitter();

// Set this to your ARTDAQ installation directory
var artdaqDir = "/home/eflumerf/Desktop/artdaq-demo-base";

// And the setup script
var setupScript = "setupARTDAQDEMO";

// System Status
var systemStatus = {
    state: "Shutdown",
    runNumber: 1000,
    dataDir: "/tmp",
    vebosity: false,
    fileSize: 0,
    fileEvents: 0,
    fileTime: 0,
    systemOutputBuffer: "",
    systemErrorBuffer: "",
    commandOutputBuffer: "",
    commandErrorBuffer: "",
    commandRunning: false,
    systemRunning: false,
    WFPlotsUpdated: Date.now(),
};

// System Command Holder (start2x2x2System.sh calls)
var system;

//Command Holder (manage2x2x2System.sh calls)
var command;

var monitorFileSize = 0;

arc.MasterInitFunction = function () { };

function startCommand(args) {
    var commandArray = [artdaqDir, setupScript, "manage2x2x2System.sh"].concat(args);
    command = spawn(__dirname + "/runARTDAQ.sh", commandArray);
    systemStatus.commandRunning = true;
    systemStatus.commandErrorBuffer = "";
    systemStatus.commandOutputBuffer = "";
    
    command.stdout.on('data', function (data) {
        systemStatus.commandOutputBuffer += data;
    });
    command.stderr.on('data', function (data) {
        // HTML-ize and color red the output
        systemStatus.commandErrorBuffer += data;
    });
    command.on('close', function (code) {
        systemStatus.commandRunning = false;
    });
}

function startSystem() {
    console.log("Starting System");
    systemStatus.systemErrorBuffer = "";
    systemStatus.systemOutputBuffer = "";
    var commandArray = [artdaqDir, setupScript, "start2x2x2System.sh"];
    system = spawn(__dirname + "/runARTDAQ.sh", commandArray);
    systemStatus.systemRunning = true;
    console.log("Command Spawned");
    system.stdout.on('data', function (data) {
        systemStatus.systemOutputBuffer += data;
    });
    system.stderr.on('data', function (data) {
        // HTML-ize and color red the output
        systemStatus.systemErrorBuffer += data;
    });
    system.on('close', function (code) {
        console.log("System command exited with code " + code);
        systemStatus.systemRunning = false;
    });
    system.on('error', function (err) {
        console.log("SYSTEM COMMAND ERROR!!!!\n" + err);
    });
    systemStatus.state = "Started";
};

function initialize(dataDir, verbose, fileSize, fileEvents, fileTime) {
    if (systemStatus.commandRunning) {
        setTimeout(function () { initialize(dataDir, verbose, fileSize, fileEvents, fileTime); });
    }
    else {
        systemStatus.dataDir = dataDir;
        systemStatus.vebosity = verbose;
        systemStatus.fileSize = fileSize;
        systemStatus.fileEvents = fileEvents;
        systemStatus.fileTime = fileTime;
        
        var verbosity = [];
        if (verbose) { verbosity = ["-v"]; }
        
        var dataDirectory = [];
        if (dataDir != "/tmp") { dataDirectory = ["-o", dataDir]; }
        
        var fileSizeCMD = [];
        if (fileSize >= 0) { fileSizeCMD = ["-s", fileSize.toString()]; }
        
        var fileEventsCMD = [];
        if (fileEvents > 0) { fileEventsCMD = ["--file-events", fileEvents.toString()]; }
        
        var fileTimeCMD = [];
        if (fileTime > 0) { fileTimeCMD = ["--file-duration", fileTime.toString()]; }
        
        var onmonDir = __dirname + "/../client/";
        
        var args = ["-m", "on", "-M"].concat(onmonDir, verbosity, dataDirectory, fileSizeCMD, fileEventsCMD, fileTimeCMD, ["init"]);
        startCommand(args)
        systemStatus.state = "Initialized";
    }
};

function startRun(number, runEvents, runTime) {
    if (systemStatus.commandRunning) {
        setTimeout(function () { startRun(number, runEvents, runTime); }, 500);
    }
    else {
        systemStatus.runNumber = number;
        
        var args = ["-N", number, "start"];
        startCommand(args)
        systemStatus.state = "Running";
        if (runEvents > 0 || runTime > 0) {
            endRun(runEvents, runTime);
        }
    }
};

function pauseRun() {
    if (systemStatus.commandRunning) {
        setTimeout(function () { pauseRun(); }, 500);
    }
    else {
        var args = ["pause"];
        startCommand(args)
        systemStatus.state = "Paused";
    }
};

function resumeRun(runEvents, runTime) {
    if (systemStatus.commandRunning) {
        setTimeout(function () { resumeRun(runEvents, runTime); }, 500);
    }
    else {
        var args = ["resume"];
        startCommand(args)
        systemStatus.state = "Running";
        if (runEvents > 0 || runTime > 0) {
            endRun(runEvents, runTime);
        }
    }
};

function endRun(runEvents, runTime) {
    if (systemStatus.commandRunning) {
        setTimeout(function () { endRun(runEvents, runTime); }, 500);
    }
    else {
        var events = [],
            time = [];
        if (runEvents > 0) { events = ["-n" , runEvents]; }
        if (runTime > 0) { time = ["-d" , runTime]; }
        
        if (runEvents > 0 || runTime > 0) {
            systemStatus.state = "Running";
            systemStatus.stopPending = true;
        } else {
            systemStatus.state = "Initialized";
        }
        var args = events.concat(time, "stop");
        startCommand(args)
    }
};

function  killSystem() {
    if (systemStatus.systemRunning) {
        if (!systemStatus.commandRunning) {
            console.log("Killing System, PID: " + system.pid);
            system.kill();
            spawn(__dirname + '/killRogueArtdaq.sh', [__dirname]);
        } else {
            setTimeout(function () { killSystem() }, 1000);
        }
    }
}

function shutdownSystem() {
    if (systemStatus.commandRunning) {
        setTimeout(function () { shutdownSystem(); }, 500);
    }
    else {
        var args = ["shutdown"];
        startCommand(args)
        systemStatus.state = "Shutdown";
    }
    
    setTimeout(function () {
        killSystem();
    }, 4000);
};

arc.GET_ = function () {
    if (fs.existsSync(__dirname + "/../client/artdaqdemo_onmon.root")) {
        var statSize = fs.statSync(__dirname + "/../client/artdaqdemo_onmon.root")["size"];
        if (statSize != monitorFileSize) {
            monitorFileSize = statSize;
            systemStatus.WFPlotsUpdated = Date.now();
        }
        //console.log("Plots Updated at " + systemStatus.WFPlotsUpdated);
    } else {
        systemStatus.WFPlotsUpdated = null;
    }
    if (systemStatus.stopPending && !systemStatus.commandRunning) {
        systemStatus.state = "Initialized";
    }
    arc.emit('end', JSON.stringify(systemStatus));
    //systemStatus.systemErrorBuffer = "";
    //systemStatus.commandErrorBuffer = "";
    //systemStatus.commandOutputBuffer = "";
    //systemStatus.systemOutputBuffer = "";
}

arc.RW_Start = function (POST) {
    if (systemStatus.state === "Shutdown") {
        startSystem();
    }
    arc.GET_();
};

arc.RW_Init = function (POST) {
    if (systemStatus.state === "Started") {
        initialize(POST.dataDir, POST.verbose, parseInt(POST.fileSize), parseInt(POST.fileEvents), parseInt(POST.fileTime));
    }
    arc.GET_();
};

arc.RW_Run = function (POST) {
    if (systemStatus.state === "Initialized") {
        startRun(POST.runNumber, parseInt(POST.runEvents), parseInt(POST.runTime));
    }
    arc.GET_();
};

arc.RW_Pause = function (POST) {
    if (systemStatus.state === "Running") {
        pauseRun();
    }
    arc.GET_();
};

arc.RW_Resume = function (POST) {
    if (systemStatus.state === "Paused") {
        resumeRun(parseInt(POST.runEvents), parseInt(POST.runTime));
    }
    arc.GET_();
};

arc.RW_End = function (POST) {
    if (systemStatus.state === "Running" || systemStatus.state === "Paused") {
        endRun(parseInt(POST.events), parseInt(POST.time));
    }
    arc.GET_();
};

arc.RW_Shutdown = function (POST) {
    if (systemStatus.state === "Started" || systemStatus.state === "Initialized" || systemStatus.state === "Paused") {
        shutdownSystem();
    }
    arc.GET_();
};

arc.RW_KILL = function (POST) {
    process.exit(1);
};

module.exports = function (module_holder) {
    module_holder["artdaq-runcontrol"] = arc;
};
