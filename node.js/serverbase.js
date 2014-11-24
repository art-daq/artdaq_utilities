// serverbase.js : Node HTTP Server
// Author: Eric Flumerfelt, FNAL RSI
// Last Modified: October 30, 2014
// Modified By: Eric Flumerfelt
//
// serverbase sets up a basic HTTP server and directs requests
// to one of its submodules. Sub-modules may be added by inserting
// appropriate code in the "GET" request section of the code below.

// Node.js framework "includes"
var http = require('http');
var url = require('url');
var fs = require('fs');
var qs = require('querystring');
var cluster = require('cluster');
var numCPUs = require("os").cpus().length;

// Sub-Module files
var procstat = require('./procstat.js'); // Runs "cat /proc/stat"
var fileserver = require('./fileserver.js'); // Redirects to https server on host, if any
var iostat = require('./iostat.js'); // Runs "iostat"
var runcommand = require('./runcommand.js'); // Prompts user for command, checks it against a "safe" list and runs it if it's there

// Write out the HTML fragment for the frame and menu
function writeFrameHTML()
{
    // When adding a submodule, don't forget to edit this file!
  return fs.readFileSync("template.html.in");
}

// Close out the HTML after the module has run
function writeHTMLClose()
{
    return "'></div></body></html>"
}

// Node.js by default is single-threaded. Start multiple servers sharing
// the same port so that an error doesn't bring the whole system down
if (cluster.isMaster) {
    // Start workers for each CPU on the host
  for (var i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // If one dies, start a new one!
  cluster.on("exit", function(worker, code, signal) {
    cluster.fork();
  });
} else {
    // Make an http server
  var server = http.createServer(function (req, res) {

    // req is the HTTP request, res is the response the server will send
    // pathname is the URL after the http://host:port/ clause
    var pathname = url.parse(req.url, true).pathname;
 
    // Log to console...
    console.log("Recieved " + req.method + " for " + pathname);
  
    // If we're recieving a POST to /runcommand (As defined in the module),
    // handle that here
    if(req.method == "POST" && pathname.search("runcommand") > 0 ) {
       var body = "";
       // res.end('post');
       //console.log('Request found with POST method');     

       // Callback for request data (may come in async)
        req.on('data', function (data) {
            body += data;
        });

        // When the request is finished, run this callback:
        req.on('end', function () {
		// Get the content of the POST request 
            var POST = qs.parse(body);
            
            // If the POST contains a "comm" value, this is the command the
	    // user typed in the "Command: " box
            if(POST.comm != null) {
		// runcommand module checks if the command is valid
              runcommand.run(POST.comm);
            }

            // If there is something in the "StdIn: " box, and the command 
            // hasn't already finished, send that input to the command's 
            // stdin stream:
            if(POST.input != null && !runcommand.done) {
              runcommand.lastComm.stdin.write(POST.input + "\n");
            }

            // Send the reply (if there was a recognized POST operation above,
	    //  getBuf() will reflect the changes).
            res.end(runcommand.getBuf());
        });
  }

    //We got a GET request!
  if(req.method == "GET") {
    // The response will always be 'text/html'. 
    // Stuff inside the iframe may be different...
    res.writeHeader({'Content-Type': 'text/html'});

    // Run procstat module
    if(pathname == "/procstat")
    {
	// Setup the callback to write the output to the response
      procstat.on('procfile', function(data) {
	      res.write(data);
        res.end(writeHTMLClose());
      });

      // Log which module we're running
      console.log("Running procstat module");
      // Write out the frame header
      res.write(writeFrameHTML() + "srcdoc='");
      // Run the module
      procstat.readfile();
    }
    // Run iostat module
    else if (pathname == "/iostat")
    {
	// IOStat module has a 'data' event and an 'iostat' event when it's done
      iostat.on('data', function(data) {
	      // Write the data
        res.write(("<p>" + data + "</p>").replace(/(\r|\n)/g,"<br>"));
      });
      
      // Write out the return code and finish the response
      iostat.on('iostat', function(code) {
        res.write("<p>Return code: " + code + "</p>");
        res.end(writeHTMLClose());
      });

      // Log which module we're running
      console.log("Running iostat module");
      // Write out the frame header
      res.write(writeFrameHTML() + "srcdoc='");
      // Run the module
      iostat.iostat();
    }
    // GET requests to runcommand/refresh are simply asking for an update 
    // for the iframe content. Send that.
    else if (pathname.search("runcommand/refresh") >= 0)
    {      
      res.end(runcommand.getBuf());
    }
    // GET to runcommand/abort means the user wants to kill the program...
    else if (pathname.search("runcommand/abort") >= 0)
    {
      runcommand.kill(runcommand.lastComm);
      res.end(runcommand.getBuf());
    }
    // Run the runcommand module
    else if (pathname.search("runcommand") >= 0 )
    {
	// Log what we're doing
      console.log("Running runcommand module");
      // Write out the frame header
      res.write(writeFrameHTML() + "srcdoc='");
      // Write the user prompt
      res.write(runcommand.writeCommandForm());
      // Finish the response
      res.end(writeHTMLClose());
    }
    // Run the fileserver module
    else if (pathname.search( "fileserver" ) >= 0) {
	// Log what we're doing
      console.log("Running fileserver module");
      // Write out the frame header. Note that fileserver is a redirect, 
      // so we're writing "src=" (the URL you want displayed) in the iframe 
      // instead of "srcdoc=" (the HTTP code you want displayed).
      res.write(writeFrameHTML() + "src='");
      // Get the URL of the host's https webserver
      res.write(fileserver(pathname, "/fileserver", req.headers["host"], "8080"));
      // Finish the response
      res.end(writeHTMLClose());
    }
    // Undefined or unknown path
    else {
	// Log what we're doing
      console.log("Running base");
      // Write out the frame code
      res.write(writeFrameHTML() + "srcdoc='");
      // A prompt!
      res.write("<p>You must select an option from the menu</p>");
      // Finish the response
      res.end(writeHTMLClose());
    }
  }
});
  //Listen on port 8080
server.listen(8080);
}
