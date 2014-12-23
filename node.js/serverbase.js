// serverbase.js : v0.4 : Node HTTPS Server
// Author: Eric Flumerfelt, FNAL RSI
// Last Modified: December 23, 2014
// Modified By: Eric Flumerfelt
//
// serverbase sets up a basic HTTPS server and directs requests
// to one of its submodules. 
//
// Implementation Notes: modules should assign their emitter to the module_holder[<modulename>] object
// modules will emit 'data' and 'end' signals and implement the function MasterInitFunction()

var cluster = require('cluster');
var numCPUs = require("os").cpus().length;
var fs = require('fs');
var path_module = require('path');
var module_holder = {};

var util = require('util');
var log_file = fs.createWriteStream(__dirname + '/server.log', { flags : 'a' });
var log_stdout = process.stdout;

console.log = function (d) { //
    log_file.write(util.format(d) + '\n');
    log_stdout.write(util.format(d) + '\n');
};

// Sub-Module files
// From: http://stackoverflow.com/questions/10914751/loading-node-js-modules-dynamically-based-on-route
function LoadModules(path) {
    var stat = fs.lstatSync(path);
    if (stat.isDirectory()) {
        // we have a directory: do a tree walk
        var files = fs.readdirSync(path);
        var f, l = files.length;
        for (var i = 0; i < l; i++) {
            f = path_module.join(path, files[i]);
            LoadModules(f);
        }
    } else if (path.search("_module.js") > 0) {
        // we have a file: load it
        require(path)(module_holder);
        console.log("Initialized Submodule " + path);
    }
}
var DIR = path_module.join(__dirname, "modules");
LoadModules(DIR);

// Node.js by default is single-threaded. Start multiple servers sharing
// the same port so that an error doesn't bring the whole system down
if (cluster.isMaster) {
    for (var name in module_holder) {
        module_holder[name].MasterInitFunction();
    }
    fs.createWriteStream(__dirname + '/server.log', { flags : 'w' });
    
    // Start workers for each CPU on the host
    for (var i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    
    // If one dies, start a new one!
    cluster.on("exit", function (worker, code, signal) {
        cluster.fork();
    });
} else {
    
    // Node.js framework "includes"
    var https = require('https');
    var http = require('http');
    var url = require('url');
    var qs = require('querystring');
    
    function serve(req, res, readOnly, username) {
        // req is the HTTP request, res is the response the server will send
        // pathname is the URL after the http://host:port/ clause
        var pathname = url.parse(req.url, true).pathname;
        if (pathname[0] === '/') {
            pathname = pathname.substr(1);
        }
        
        var moduleName = pathname.substr(0, pathname.indexOf('/'));
        var functionName = pathname.substr(pathname.indexOf('/') + 1);
        //console.log("req.client debug info: " + req.client + ", pathname: " + pathname);
        
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 200;
        // Log to console...
        //console.log("Recieved " + req.method + " for " + pathname);
        //console.log("Proceeding...");
        
        // If we're recieving a POST to /runcommand (As defined in the module),
        // handle that here
        if (req.method === "POST") {
            console.log("In POST handler, PID: " + process.pid);
            var body = "";
            
            // Callback for request data (may come in async)
            req.on('data', function (data) {
                body += data;
            });
            
            req.on('end', function () {
                // Get the content of the POST request 
                var POST = qs.parse(body);
                POST.who = username;
                
                if (module_holder[moduleName] != null) {
                    console.log("Module " + moduleName + ", function " + functionName + " accessType " + (readOnly ? "RO" : "RW"));
                    var dataTemp = "";
                    module_holder[moduleName].removeAllListeners('data').on('data', function (data) {
                        //res.write(JSON.stringify(data));
                        dataTemp += data;
                    });
                    module_holder[moduleName].removeAllListeners('end').on('end', function (data) {
                        res.end(JSON.stringify(dataTemp + data));
                    });
                    if (readOnly) {
                        try {
                            var data = module_holder[moduleName]["RO_" + functionName](POST);
                            if (data != null) {
                                res.end(JSON.stringify(data));
                            }
                        } catch (err) {
                            if (err instanceof TypeError) {
                                console.log("Unauthorized access attempt: " + username + ": " + moduleName + "/" + functionName);
                                res.end(JSON.stringify(null));
                            }
                        }
                    } else {
                        try {
                            var data = module_holder[moduleName]["RW_" + functionName](POST);
                            if (data != null) {
                                res.end(JSON.stringify(data));
                            }
                        } catch (err) {
                            if (err instanceof TypeError) {
                                //RW_ version not available, try read-only version:
                                var data = module_holder[moduleName]["RO_" + functionName](POST);
                                if (data != null) {
                                    res.end(JSON.stringify(data));
                                }
                            }
                        }
                    }
                } else {
                    console.log("Unknown POST URL: " + pathname);
                    res.writeHeader(404, { 'Content-Type': 'text/html' });
                    res.end("Error");
                }
            });
        }
        //We got a GET request!
        if (req.method === "GET") {
            //console.log("In GET handler, PID: " + process.pid);
            if (pathname.search(".js") > 0) {
                console.log("Sending ./modules/" + moduleName + "/client/" + functionName);
                res.setHeader("Content-Type", "text/javascript");
                res.end(fs.readFileSync("./modules/" + moduleName + "/client/" + functionName), 'utf-8');
                console.log("Done sending ./modules/" + moduleName + "/client/" + functionName);
            } else if (pathname.search("css") > 0) {
                console.log("Sending ./modules/" + moduleName + "/client/" + functionName);
                res.setHeader("Content-Type", "text/css");
                res.end(fs.readFileSync("./modules/" + moduleName + "/client/" + functionName), 'utf-8');
                console.log("Done sending ./modules/" + moduleName + "/client/" + functionName);
            } else if (pathname.search(".html") > 0) {
                console.log("Sending ./modules/" + moduleName + "/client/" + functionName);
                // Write out the frame code
                res.setHeader("Content-Type", "text/html");
                res.end(fs.readFileSync("./modules/" + moduleName + "/client/" + functionName), 'utf-8');
                console.log("Done sending ./modules/" + moduleName + "/client/" + functionName);
            } else if (module_holder[moduleName] != null) {
                console.log("Module " + moduleName + ", function GET_" + functionName);
                
                var dataTemp = "";
                module_holder[moduleName].removeAllListeners('data').on('data', function (data) {
                    //res.write(JSON.stringify(data));
                    dataTemp += data;
                });
                module_holder[moduleName].removeAllListeners('end').on('end', function (data) {
                    res.end(JSON.stringify(dataTemp + data));
                });
                var data = module_holder[moduleName]["GET_" + functionName]();
                if (data != null) {
                    res.end(JSON.stringify(data));
                }
            } else {
                console.log("Sending client.html");
                // Write out the frame code
                res.setHeader("Content-Type", "text/html");
                res.end(fs.readFileSync("./client.html"), 'utf-8');
                console.log("Done sending client.html");
            }
        }
    }
    
    console.log("Setting up options");
    var options = {
        key: fs.readFileSync('./certs/server.key'),
        cert: fs.readFileSync('./certs/server.crt'),
        ca: fs.readFileSync('./certs/ca.crt'),
        requestCert: true,
        rejectUnauthorized: false
    };
    var k5login = " " + fs.readFileSync(process.env.HOME + "/.k5login");
    console.log("Done setting up options");
    
    // Make an http server
    var server = https.createServer(options, function (req, res) {
        var readOnly = true;
        var clientCertificate = req.connection.getPeerCertificate();
        var username = "HTTPS User";
        if (req.client.authorized) {
            username = clientCertificate.subject.CN[0];
            var useremail = clientCertificate.subject.CN[1].substr(4);
            var userFNAL = useremail + "@FNAL.GOV";
            var userWIN = useremail + "@FERMI.WIN.FNAL.GOV";
            if (k5login.search(userFNAL) >= 0 || k5login.search(userWIN) >= 0) {
                readOnly = false;
            }
        }
        serve(req, res, readOnly, username);
    });
    var insecureServer = http.createServer(function (req, res) {
        serve(req, res, true, "HTTP User");
    });
    
    var baseport = 8080;
    if (__dirname.search("dev") >= 0) {
        baseport = 9090;
    }
    console.log("Listening on port " + baseport);
    server.listen(baseport + 1);
    insecureServer.listen(baseport);
}
