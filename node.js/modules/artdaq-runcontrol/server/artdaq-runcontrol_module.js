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
var Status = function (partition) {
    this.state = "Shutdown";
    this.runNumber = 1000;
    this.dataDir = "/tmp";
    this.vebosity = false;
    this.fileSize = 0;
    this.fileEvents = 0;
    this.fileTime = 0;
    this.systemPID = null;
    this.systemRunning = false;
    this.systemOutputBuffer = "";
    this.systemErrorBuffer = "";
    this.commandPID = null;
    this.commandRunning = false;
    this.commandOutputBuffer = "";
    this.commandErrorBuffer = "";
    this.WFPlotsUpdated = Date.now();
    this.WFFileSize = 0;
    this.WFFileMtime = 0;
    this.partition = partition;
};

arc.MasterInitFunction = function (workerData) {
    var output = {};
    output.p0 = new Status(0);
    output.p1 = new Status(1);
    output.p2 = new Status(2);
    output.p3 = new Status(3);
    
    if(!fs.existsSync(__dirname + "/../client/P0")) {
        fs.mkdirSync(__dirname + "/../client/P0");
    }
    if(!fs.existsSync(__dirname + "/../client/P1")) {
        fs.mkdirSync(__dirname + "/../client/P1");
    }
    if(!fs.existsSync(__dirname + "/../client/P2")) {
        fs.mkdirSync(__dirname + "/../client/P2");
    }
    if(!fs.existsSync(__dirname + "/../client/P3")) {
        fs.mkdirSync(__dirname + "/../client/P3");
    }

    fs.chmodSync(__dirname + "/runARTDAQ.sh", '777');
    fs.chmodSync(__dirname + "/killArtdaq.sh", '777');
    fs.chmodSync(__dirname + "/cleanupArtdaq.sh", '777');

    workerData["artdaq-runcontrol"] = output;
};

function checkCommand(systemStatus) {
    if (systemStatus.commandPID != null) {
        try {
            process.kill(systemStatus.commandPID, 0);
            systemStatus.commandRunning = true;
        } catch (err) {
            systemStatus.commandRunning = false;
            systemStatus.commandPID = null;
        }
    } else {
        systemStatus.commandRunning = false;
    }
}

function checkSystem(systemStatus) {
    if (systemStatus.systemPID != null) {
        try {
            process.kill(systemStatus.systemPID, 0);
            systemStatus.systemRunning = true;
        } catch (err) {
            systemStatus.systemRunning = false;
            systemStatus.systemPID = null;
        }
    } else {
        systemStatus.systemRunning = false;
    }
}

function startCommand(args, systemStatus) {
    var port = (systemStatus.partition * 100) + 5600;
    var commandArray = [artdaqDir, setupScript, port, "manage2x2x2System.sh"].concat(args);
    systemStatus.commandErrorBuffer = "";
    systemStatus.commandOutputBuffer = "";
    var out = fs.openSync(__dirname + "/../client/P" + systemStatus.partition + "/comm.out.log", 'w');
    var err = fs.openSync(__dirname + "/../client/P" + systemStatus.partition + "/comm.err.log", 'w');
    console.log("Spawning: " + __dirname + "/runARTDAQ.sh " + commandArray);
    var command = spawn(__dirname + "/runARTDAQ.sh", commandArray, { detached: true, stdio: ['ignore', out, err] });
    systemStatus.commandPID = command.pid;
    command.unref();
    systemStatus.commandRunning = true;
    checkCommand(systemStatus);
}

function startSystem(systemStatus) {
    console.log("Starting System, Partition " + systemStatus.partition);
    var port = (systemStatus.partition * 100) + 5600;
    var commandArray = [artdaqDir, setupScript, port, "start2x2x2System.sh", "-p", port];
    
    var out = fs.openSync(__dirname + "/../client/P" + systemStatus.partition + "/out.log", 'w');
    var err = fs.openSync(__dirname + "/../client/P" + systemStatus.partition + "/err.log", 'w');
    systemStatus.systemErrorBuffer = "";
    systemStatus.systemOutputBuffer = "";
    console.log("Spawning: " + __dirname + "/runARTDAQ.sh " + commandArray.join(' '));
    var system = spawn(__dirname + "/runARTDAQ.sh", commandArray, { detached: true, stdio: ['ignore', out, err] });
    systemStatus.systemPID = system.pid;
    system.unref();
    systemStatus.systemRunning = true;
    console.log("Command Spawned");
    
    systemStatus.state = "Started";
};

function initialize(systemStatus, dataDir, verbose, fileSize, fileEvents, fileTime) {
    if (systemStatus.commandRunning) {
        setTimeout(function () { initialize(systemStatus, dataDir, verbose, fileSize, fileEvents, fileTime); });
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
        
        var onmonDir = __dirname + "/../client/P" + systemStatus.partition;
        
        var args = ["-m", "on", "-M"].concat(onmonDir, verbosity, dataDirectory, fileSizeCMD, fileEventsCMD, fileTimeCMD, ["init"]);
        startCommand(args, systemStatus)
        systemStatus.state = "Initialized";
    }
};

function startRun(systemStatus, number, runEvents, runTime) {
    if (systemStatus.commandRunning) {
        setTimeout(function () { startRun(systemStatus, number, runEvents, runTime); }, 500);
    }
    else {
        systemStatus.runNumber = number;
        
        var args = ["-N", number, "start"];
        startCommand(args, systemStatus)
        systemStatus.state = "Running";
        if (runEvents > 0 || runTime > 0) {
            endRun(systemStatus, runEvents, runTime);
        }
    }
};

function pauseRun(systemStatus) {
    if (systemStatus.commandRunning) {
        setTimeout(function () { pauseRun(systemStatus); }, 500);
    }
    else {
        var args = ["pause"];
        startCommand(args, systemStatus)
        systemStatus.state = "Paused";
    }
};

function resumeRun(systemStatus, runEvents, runTime) {
    if (systemStatus.commandRunning) {
        setTimeout(function () { resumeRun(systemStatus, runEvents, runTime); }, 500);
    }
    else {
        var args = ["resume"];
        startCommand(args, systemStatus)
        systemStatus.state = "Running";
        if (runEvents > 0 || runTime > 0) {
            endRun(systemStatus, runEvents, runTime);
        }
    }
};

function endRun(systemStatus, runEvents, runTime) {
    if (systemStatus.commandRunning) {
        setTimeout(function () { endRun(systemStatus, runEvents, runTime); }, 500);
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
        startCommand(args, systemStatus)
    }
};

function killSystem(systemStatus) {
    checkCommand(systemStatus);
    if (!systemStatus.commandRunning) {
        checkSystem(systemStatus);
        if (systemStatus.systemRunning) {
            console.log("Killing System, PID: " + systemStatus.systemPID);
            spawn(__dirname + '/killArtdaq.sh', [systemStatus.systemPID]);
            setTimeout(function () { killSystem(systemStatus); }, 1000);
        }
    } else {
        console.log("Command running, spinning...")
        setTimeout(function () { killSystem(systemStatus) }, 1000);
    }
}

function shutdownSystem(systemStatus) {
    if (systemStatus.commandRunning) {
        setTimeout(function () { shutdownSystem(systemStatus); }, 500);
    }
    else {
        console.log("Shutting down system, Partition " + systemStatus.partition);
        var args = ["shutdown"];
        startCommand(args, systemStatus);
        spawn(__dirname + '/cleanupArtdaq.sh', [__dirname, systemStatus.partition]);
        systemStatus.state = "Shutdown";
    }
    
    setTimeout(function () {
        killSystem(systemStatus);
    }, 4000);
};

function getStatus(systemStatuses, partition) {
    var systemStatus = systemStatuses["p" + partition];
    checkCommand(systemStatus);
    checkSystem(systemStatus);
    if (fs.existsSync(__dirname + "/../client/P" + systemStatus.partition + "/artdaqdemo_onmon.root")) {
        var stats = fs.statSync(__dirname + "/../client/P" + systemStatus.partition + "/artdaqdemo_onmon.root");
        var statSize = stats["size"];
        if (statSize != systemStatus.WFFileSize) {
            systemStatus.WFFileSize = statSize;
            systemStatus.WFPlotsUpdated = Date.now();
            console.log("Plots Updated at " + systemStatus.WFPlotsUpdated);
        }
        if ( stats["mtime"] - systemStatus.WFFileMtime ) {
            systemStatus.WFFileMtime = stats["mtime"];
            systemStatus.WFPlotsUpdated = Date.now();
            console.log("Plots Updated at " + systemStatus.WFPlotsUpdated);
        }
            } else {
        systemStatus.WFPlotsUpdated = null;
    }
    if (fs.existsSync(__dirname + "/../client/P" + systemStatus.partition + "/out.log")) {
        systemStatus.systemOutputBuffer = "" + fs.readFileSync(__dirname + "/../client/P" + systemStatus.partition + "/out.log")
    }
    if (fs.existsSync(__dirname + "/../client/P" + systemStatus.partition + "/err.log")) {
        systemStatus.systemErrorBuffer = "" + fs.readFileSync(__dirname + "/../client/P" + systemStatus.partition + "/err.log")
    }
    if (fs.existsSync(__dirname + "/../client/P" + systemStatus.partition + "/comm.out.log")) {
        systemStatus.commandOutputBuffer = "" + fs.readFileSync(__dirname + "/../client/P" + systemStatus.partition + "/comm.out.log")
    }
    if (fs.existsSync(__dirname + "/../client/P" + systemStatus.partition + "/comm.err.log")) {
        systemStatus.commandErrorBuffer = "" + fs.readFileSync(__dirname + "/../client/P" + systemStatus.partition + "/comm.err.log")
    }
    if (systemStatus.stopPending && !systemStatus.commandRunning) {
        systemStatus.state = "Initialized";
    }
    arc.emit('end', JSON.stringify(systemStatus));
}

arc.GET_P0 = function (systemStatuses) {
    getStatus(systemStatuses, 0);
}

arc.GET_P1 = function (systemStatuses) {
    getStatus(systemStatuses, 1);
}

arc.GET_P2 = function (systemStatuses) {
    getStatus(systemStatuses, 2);
}

arc.GET_P3 = function (systemStatuses) {
    getStatus(systemStatuses, 3);
}

arc.RW_Start = function (POST, systemStatuses) {
    if (systemStatuses["p" + POST.partition].state === "Shutdown") {
        startSystem(systemStatuses["p" + POST.partition]);
    }
    getStatus(systemStatuses, POST.partition);
};

arc.RW_Init = function (POST, systemStatuses) {
    if (systemStatuses["p" + POST.partition].state === "Started") {
        initialize(systemStatuses["p" + POST.partition], POST.dataDir, POST.verbose, parseInt(POST.fileSize), parseInt(POST.fileEvents), parseInt(POST.fileTime));
    }
    getStatus(systemStatuses, POST.partition);
};

arc.RW_Run = function (POST, systemStatuses) {
    if (systemStatuses["p" + POST.partition].state === "Initialized") {
        startRun(systemStatuses["p" + POST.partition], POST.runNumber, parseInt(POST.runEvents), parseInt(POST.runTime));
    }
    getStatus(systemStatuses, POST.partition);
};

arc.RW_Pause = function (POST, systemStatuses) {
    if (systemStatuses["p" + POST.partition].state === "Running") {
        pauseRun(systemStatuses["p" + POST.partition]);
    }
    getStatus(systemStatuses, POST.partition);
};

arc.RW_Resume = function (POST, systemStatuses) {
    if (systemStatuses["p" + POST.partition].state === "Paused") {
        resumeRun(systemStatuses["p" + POST.partition], parseInt(POST.runEvents), parseInt(POST.runTime));
    }
    getStatus(systemStatuses, POST.partition);
};

arc.RW_End = function (POST, systemStatuses) {
    if (systemStatuses["p" + POST.partition].state === "Running" || systemStatuses["p" + POST.partition].state === "Paused") {
        endRun(systemStatuses["p" + POST.partition], parseInt(POST.events), parseInt(POST.time));
    }
    getStatus(systemStatuses, POST.partition);
};

arc.RW_Shutdown = function (POST, systemStatuses) {
    if (systemStatuses["p" + POST.partition].state === "Started" || systemStatuses["p" + POST.partition].state === "Initialized" || systemStatuses["p" + POST.partition].state === "Paused") {
        shutdownSystem(systemStatuses["p" + POST.partition]);
    }
    getStatus(systemStatuses, POST.partition);
};

module.exports = function (module_holder) {
    module_holder["artdaq-runcontrol"] = arc;
};
