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
var spawn = require('child_process').spawn;
var emitter = require('events').EventEmitter;

// So that we can send events back to serverbase
var runcommand = new emitter();
// A string buffer for the command's output, HTML'd
var buf = "";
// Is the command complete?
runcommand.done = false;
    // A copy of the string buffer, to check for differences
var oldbuf = "";
// How many times have we refreshed and seen the same buffer?
var count = 0;

// Which commands am I allowed to run?
var safeCommands = [ "ls", "cat", "echo", "\/home\/eflumerf\/safe" ];

// Return HTML code for a "Command: <input box> <submit button>" form
runcommand.writeCommandForm = function ()
{
  return "<form name=\"input\" action=\"/runcommand/refresh\" method=\"post\">Command: <input type=\"text\" name=\"comm\"><input type=\"submit\" value=\"Submit\"></form>"
}

// Return HTML code for a Cancel button
function writeCancelForm()
{
  return "<form name=\"abort\" action=\"/runcommand/abort\" method=\"get\"><input type=\"submit\" value=\"Cancel\"></form>"
}

// Return HMTL code for a "StdIn: <input box> <submit button> form
function writeStdInForm()
{
  return "<form name=\"stdin\" action=\"/runcommand/refresh\" method=\"post\">StdIn: <input type=\"text\" name=\"input\"><input type=\"submit\" value=\"Send\"></form>"
}

// Return HTML code for a Refresh button
function writeRefreshForm()
{
  return "<form name=\"refresh\" action=\"/runcommand/refresh\" method=\"get\"><input type=\"submit\" value=\"Refresh\"></form>"
}

// If the buffer has changed, write a refresh meta-header with a 
// 1-second interval. If it hasn't for more than two checks, write the
// stdin form and change the refresh interval to 10 seconds (so that the
// user has time to type a response).
function writeRefreshTag ()
{
  if( oldbuf == buf && count > 1 ) {
    count = 0;
    return "<head><META HTTP-EQUIV=\"refresh\" CONTENT=\"10\"></head><body>" + writeStdInForm();
  }
  else
  {
    count++;
    oldbuf = buf;
    return "<head><META HTTP-EQUIV=\"refresh\" CONTENT=\"1\"></head><body>"
  }

}

// Put it all together: write out the buffer and appropriate form elements
runcommand.getBuf = function() {
  var header, footer

  // Write this stuff if the command is still running
  if (!runcommand.done) {
    header = "<html>" + writeRefreshTag() + writeCancelForm() + writeRefreshForm();
    footer = "</body></html>"
  }
  // Write this stuff if the command is done
  else {
    header = "<html><body>";
    footer =  runcommand.writeCommandForm() + "</body></html>"
  }

  return header + buf + footer;
}

// Kill the command
runcommand.kill = function (commd)
{
  commd.kill();
  buf += "COMMAND KILLED!"
}

//From: http://stackoverflow.com/questions/237104/array-containsobj-in-javascript
function contains(a, obj) {
    for (var i = 0; i < a.length; i++) {
        console.log("Is " + obj + " in " + a[i] + "?")
        if (("" + obj).search("" + a[i]) >= 0) {
            return true;
        }
    }
    return false;
}

// Entry point for the module. Check the passed command and run it if 
// it's in the safe list
runcommand.run = function (comm) {
    // Log the recieved command
  console.log("Command: "+ comm);

  // Make an array of the space-delimited arguments. Pull out the first one
  // (the command to be run)
  var commArr = comm.split(' ');
  var command = commArr[0];
  commArr.shift();

  // If the command is in the safe list, and actually exists:
  if(contains(safeCommands, command) && ( fs.existsSync(command) || fs.existsSync("/bin/" + command) || fs.existsSync("/usr/bin/" + command)) && !contains(commArr,"`"))
  {
      // Start the command
    var commd = spawn(command,commArr);
    // Save a reference to the command (for stdin and kill)
    runcommand.lastComm = commd;
    // Reset the buffer
    buf = ""
	// Reset the done flag
    runcommand.done = false;

    // When the command prints to stdout, this callback is called
    commd.stdout.on('data',function (data) {
	    // HTML-ize the output
      buf += ("<p style=\"color:black\">" + data + "</p>").replace(/(\r|\n)/g,"<br>")
    });

    // When the command prints to stderr, this callback is called
    commd.stderr.on('data', function (data) {
	    // HTML-ize and color red the output
      buf += ("<p style=\"color:red\">" + data + "</p>").replace(/(\r|\n)/g,"<br>");
  });

    // When the command is complete, this callback is called
    commd.on('close',function (code) {
	    // Print the command's return code
      buf += "<p>Return code: " + code + "</p><br><br>"
	  // Set the done flag
      runcommand.done = true;
    });
  }
  else {
      // Tell the user that what they typed was no good
    buf = "<p>Invalid Command: " + comm + "</p>";
    // We're done, write out the new command prompt
    runcommand.done = true;
  }
}

module.exports = runcommand;
