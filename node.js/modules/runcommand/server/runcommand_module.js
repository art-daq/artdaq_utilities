// runcommand.js
// Author: Eric Flumerfelt, FNAL/RSI
// Last Modified: October 30, 2014
// Modified By: Eric Flumerfelt
//
// runcommand runs a system command and returns the output through GET
// operations to /runcommand/refresh. It also prompts the user for input
// if the running command appears to have stalled. It colors Stderr red
// for easy visibility. When the command completes, it prints the return
// code and asks for another command to run.
//
// runcommand only runs if the command is a defined "safe" command

// Node.js "includes"
var fs = require('fs');
var path_module = require('path');
var spawn = require('child_process').spawn;
var emitter = require('events').EventEmitter;

// So that we can send events back to serverbase
var runcommand = new emitter();
// A string buffer for the command's output, HTML'd
var buf = "";
runcommand.done = true;

// Which commands am I allowed to run?
var clientCommands = fs.readdirSync(path_module.join(__dirname, "..", "client"));
var safeCommands = ["ls", "cat", "echo", "iostat"];
for (var name in clientCommands) {
    if (clientCommands[name].search(".sh") > 0) {
        safeCommands.push(clientCommands[name]);
    }
}

runcommand.MasterInitFunction = function () { };


// Entry point for the module. Check the passed command and run it if 
// it's in the safe list
runcommand.RW_Run = function (POST) {
    // Log the recieved command
    console.log("Command: " + POST.comm);
    
    // Make an array of the space-delimited arguments. Pull out the first one
    // (the command to be run)
    var commArr = POST.comm.split(' ');
    var command = commArr[0];
    commArr.shift();
    
    console.log("Command: " + command + ", Arguments: " + commArr);
    var safeCommandArgs = true;
    for (var name in commArr) {
        if (commArr[name].indexOf('`') >= 0) {
            safeCommandArgs = false;
        }
    }
        
    // If the command is in the safe list, and actually exists:
    if (safeCommandArgs && safeCommands.indexOf(command) >= 0 && (fs.existsSync(path_module.join(__dirname, "..", "client") +"/"+  command) || fs.existsSync("/bin/" + command) || fs.existsSync("/usr/bin/" + command))) {
        // Start the command
        if (fs.existsSync(path_module.join(__dirname, "..", "client") +"/"+ command)) {
            command = path_module.join(__dirname, "..", "client") +"/"+ command;
        }
        var commd = spawn(command, commArr);
        // Save a reference to the command (for stdin and kill)
        runcommand.lastComm = commd;
        runcommand.done = false;
        // Reset the buffer
        buf = ""
        
        // When the command prints to stdout, this callback is called
        commd.stdout.on('data', function (data) {
            // HTML-ize the output
            buf += ("<p style=\"color:black\">" + data + "</p>").replace(/(\r|\n)/g, "<br>")
        });
        
        // When the command prints to stderr, this callback is called
        commd.stderr.on('data', function (data) {
            // HTML-ize and color red the output
            buf += ("<p style=\"color:red\">" + data + "</p>").replace(/(\r|\n)/g, "<br>");
        });
                
        // When the command is complete, this callback is called
        commd.on('exit', function (code) {
            // Print the command's return code
            buf += "<p>Return code: " + code + "</p><br><br>"
            runcommand.done = true;
        });
    }
    else {
        console.log("Invalid Command Entered: " + command);
        // Tell the user that what they typed was no good
        buf = "<p>Invalid Command: " + POST.comm + "</p>";
    }
    
    runcommand.GET_();
}

runcommand.RW_Abort = function (POST) {
    if (!runcommand.done) {
        buf += "<p style='color:red'>Command Killed</p>";
    }
    runcommand.lastComm.kill();
    runcommand.GET_();
};

runcommand.RW_Input = function (POST) {
    if (POST.input != null && !runcommand.done) {
        runcommand.lastComm.stdin.write(POST.input + "\n");
    }
    runcommand.GET_();
};

runcommand.GET_ = function () {
    runcommand.emit('end', buf);
    buf = "";
};

module.exports = function (module_holder) {
    module_holder["runcommand"] = runcommand;
};
