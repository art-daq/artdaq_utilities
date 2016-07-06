#!/usr/bin/node
// serverbase.js : v0.5 : Node HTTPS Server
// Author: Eric Flumerfelt, FNAL RSI
// Last Modified: June 3, 2015
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
var workerData = {};

var util = require('util');
var log_file = fs.createWriteStream('/tmp/server.' + process.env["USER"] + '.log', { flags : 'a' });
var log_stdout = process.stdout;

console.log = function (d) { //
	log_file.write(util.format(d) + '\n');
	log_stdout.write(util.format(d) + '\n');
};

function LoadCerts(path) {
	var output = [];
	var files = fs.readdirSync(path);
	for (var i = 0; i < files.length; i++) {
		if (files[i].search(".pem") > 0 || files[i].search(".crt") > 0) {
			output.push(fs.readFileSync(path + "/" + files[i]));
		}
	}
	return output;
}

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
	} else if (path.search("_module.js") > 0 && path.search("js~") < 0) {
		console.log("Loading Submodule " + path);
		// we have a file: load it
		// ReSharper disable once UseOfImplicitGlobalInFunctionScope
		require(path)(module_holder);
		console.log("Initialized Submodule " + path);
	}
}
var DIR = path_module.join(__dirname, "modules");
LoadModules(DIR);

// Node.js by default is single-threaded. Start multiple servers sharing
// the same port so that an error doesn't bring the whole system down
if (cluster.isMaster) {
	
	function messageHandler(msg) {
		//console.log("Received message from worker");
		if (!msg["name"]) {
			//workerData = msg;
			console.log("Depreciated message recieved!");
		}
		if (msg["name"]) {
			if (msg["name"] === "request") {
				console.log("Request for Worker Data received");
				Object.keys(cluster.workers).forEach(function (id) {
					cluster.workers[id].send(workerData);
				});
			}
			else if (!msg["target"]) {
				console.log("Depreciated message recieved!");
		//console.log("Recieved message from worker: Setting workerData[" + msg.name + "].");
		//workerData[msg.name] = msg.data;
		//Object.keys( cluster.workers ).forEach( function ( id ) {
		//   cluster.workers[id].send( {name:msg.name, data:workerData[msg.name]} );
		//} );
			} else {
				if (!msg["method"]) {
					//console.log("Recieved message from worker: Setting workerData[" + msg.name + "]["+msg.target+"].");
					workerData[msg.name][msg.target] = msg.data;
				}
				else if (msg["method"] === "push") {
					//console.log("Recieved message from worker: Adding to workerData[" + msg.name + "]["+msg.target+"].");
					workerData[msg.name][msg.target].push(msg.data);
				}
				Object.keys(cluster.workers).forEach(function (id) {
					cluster.workers[id].send({ name: msg.name, target: msg.target, data: workerData[msg.name][msg.target] });
				});
			}
		}
	}
	
	// Call Master Init functions
	for (var name in module_holder) {
		if (module_holder.hasOwnProperty(name)) {
			try {
				module_holder[name].MasterInitFunction(workerData);
			} catch (err) {
				;
			}
			module_holder[name].on("message", messageHandler);
		}
	}
	//fs.createWriteStream(__dirname + '/server.log', { flags : 'w' });
	
	cluster.on('online', function (worker) {
		worker.send(workerData);
	});
	
	// Start workers for each CPU on the host
	for (var i = 0; i < numCPUs; i++) {
		//for (var i = 0; i < 1; i++) {
		var worker = cluster.fork();
		worker.on('message', messageHandler);
	}
	
	// If one dies, start a new one!
	cluster.on("exit", function () {
		var newWorker = cluster.fork();
		newWorker.on('message', messageHandler);
	});
} else {
	// Node.js framework "includes"
	var https = require('https');
	var http = require('http');
	var url = require('url');
	var qs = require('querystring');
	
	function workerMessageHandler(msg) {
		if (!msg["name"]) {
			//console.log("Received Data Dump from Master!");
			//console.log(JSON.stringify(msg));
			workerData = msg;
		for (var name in module_holder) {
			if (module_holder.hasOwnProperty(name)) {
				try {
					module_holder[name].Update(workerData[name]);
				} catch (err) {;
				}
			}
		}
		} else {
			if (!msg["target"]) {
				//console.log("Received message from master: Setting workerData[" + msg.name + "].");
				workerData[msg.name] = msg.data;
			} else {
				//console.log("Received message from master: Setting workerData[" + msg.name + "][" + msg.target + "].");
				workerData[msg.name][msg.target] = msg.data;
			}
            try {
            module_holder[msg.name].Update(workerData[name]);
            } catch (err) {;}
		}
	}
	
	process.send({ name: 'request' });
	process.on('message', workerMessageHandler);
	
	for (var name in module_holder) {
		if (module_holder.hasOwnProperty(name)) {
			module_holder[name].on("message", function (data) {
				//console.log("Received message from module " + data.name);
				// ReSharper disable once UseOfImplicitGlobalInFunctionScope
				process.send(data);
			});
			try {
				module_holder[name].WorkerInitFunction(workerData);
			} catch (err) {
				;
			}
		}
	}
	
	function serve(req, res, readOnly, username) {
		// req is the HTTP request, res is the response the server will send
		// pathname is the URL after the http://host:port/ clause
		var pathname = url.parse(req.url, true).pathname;
		if (pathname[0] === '/') {
			pathname = pathname.substr(1);
		}
		
		var moduleName = pathname.substr(0, pathname.indexOf('/'));
		var functionName = pathname.substr(pathname.indexOf('/') + 1);
		
		var dnsDone = false;
		// ReSharper disable once UseOfImplicitGlobalInFunctionScope
		require('dns').reverse(req.connection.remoteAddress, function (err, domains) {
			dnsDone = true;
			if (!err) {
				if (functionName.search(".min.map") < 0) {
					// ReSharper disable UseOfImplicitGlobalInFunctionScope
					console.log("Received " + req.method + ", Client: " + domains[0] + " [" + req.connection.remoteAddress + "], PID: " + process.pid + " Module: " + moduleName + ", function: " + functionName);
// ReSharper restore UseOfImplicitGlobalInFunctionScope
				}
				return domains[0];
			} else {
				if (functionName.search(".min.map") < 0) {
					// ReSharper disable UseOfImplicitGlobalInFunctionScope
					console.log("Received " + req.method + ", Client: " + req.connection.remoteAddress + ", PID: " + process.pid + " Module: " + moduleName + ", function: " + functionName);
// ReSharper restore UseOfImplicitGlobalInFunctionScope
				}
				return "";
			}
		});
		if (moduleName === ".." || functionName.search("\\.\\.") >= 0) {
			console.log("Possible break-in attempt!: " + pathname);
			res.writeHeader(404, { 'Content-Type': 'text/html' });
			res.end("Error");
			return;
		}
		res.setHeader("Content-Type", "application/json");
		res.statusCode = 200;
		// Log to console...
		//console.log("Received " + req.method + " for " + pathname);
		//console.log("Proceeding...");
		
		// If we're recieving a POST to /runcommand (As defined in the module),
		// handle that here
		if (req.method === "POST") {
			var body = "";
			
			// Callback for request data (may come in async)
			req.on('data', function (data) {
				body += data;
			});
			
			req.on('end', function () {
				// Get the content of the POST request 
				var post;
				try {
					post = JSON.parse(body);
				} catch (e) {
					post = qs.parse(body);
				}
				post.who = username;
				
				if (module_holder[moduleName] != null) {
					console.log("Module " + moduleName + ", function " + functionName + " accessType " + (readOnly ? "RO" : "RW"));
					var dataTemp = "";
					module_holder[moduleName].removeAllListeners('data').on('data', function (data) {
						dataTemp += data;
					});
					module_holder[moduleName].removeAllListeners('end').on('end', function (data) {
						//console.log("POST Operation Complete, sending data to client: " + JSON.stringify(dataTemp + data));
						res.end(JSON.stringify(dataTemp + data));
					});
					module_holder[moduleName].removeAllListeners('stream').on('stream', function (str, hdrs, code) {
						console.log("Stream message received: " + hdrs + " CODE: " + code);
						res.writeHead(code, hdrs);
						str.pipe(res);
					});
					var data;
					if (readOnly) {
						try {
							data = module_holder[moduleName]["RO_" + functionName](post, workerData[moduleName]);
							if (data != null) {
								//console.log("RO POST Returning: " + JSON.stringify(data));
								res.end(JSON.stringify(data));
							}
						} catch (err) {
							if (err instanceof TypeError) {
								//console.log( "Unauthorized access attempt: " + username + ": " + moduleName + "/" + functionName );
								res.end(JSON.stringify(null));
							}
						}
					} else {
						try {
							data = module_holder[moduleName]["RW_" + functionName](post, workerData[moduleName]);
							if (data != null) {
								//console.log("RW POST returned data: " + JSON.stringify(data));
								res.end(JSON.stringify(data));
							}
						} catch (err2) {
							console.log("Error caught; text: " + JSON.stringify(err2));
							if (err2 instanceof TypeError) {
								//RW_ version not available, try read-only version:
								data = module_holder[moduleName]["RO_" + functionName](post, workerData[moduleName]);
								if (data != null) {
									//console.log("RO Fallback POST returned data: " + JSON.stringify(data));
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
		if (req.method === "GET" || req.method === "HEAD") {
			//console.log(req.headers);
			if (functionName.indexOf(".") > 0) {
				//console.log("Client File Access Requested");
				var ext = functionName.substr(functionName.lastIndexOf(".") + 1);
				res.setHeader("Content-Type", "text/plain");
				//console.log("Extension: " + ext);
				switch (ext) {
					case "css":
						res.setHeader("Content-Type", "text/css");
						break;
					case "js":
						res.setHeader("Content-Type", "text/javascript");
						break;
					case "html":
						res.setHeader("Content-Type", "text/html");
						break;
					case "htm":
						res.setHeader("Content-Type", "text/html");
						break;
					case "root":
						res.setHeader("Content-Type", "application/root+root.exe");
						break;
					case "gif":
						res.setHeader("Content-Type", "image/gif");
						break;
				}
				
				var filename = "./modules/" + moduleName + "/client/" + functionName;
				if (functionName.search("favicon.ico") >= 0) {
					filename = "./modules/base/client/images/favicon.ico";
				}
				if (fs.existsSync(filename)) {
					res.setHeader("Content-Length", fs.statSync(filename)["size"]);
					if (req.headers.range != null) {
						var range = req.headers.range;
						var offset = parseInt(range.substr(range.indexOf('=') + 1, range.indexOf('-') - (range.indexOf('=') + 1)));
						var endOffset = parseInt(range.substr(range.indexOf('-') + 1));
						console.log("Reading (" + offset + ", " + endOffset + ")");
						
						res.setHeader("Content-Length", (endOffset - offset + 1).toString());
						var readStream = fs.createReadStream(filename, { start: parseInt(offset), end: parseInt(endOffset) });
						readStream.pipe(res);
					} else {
						res.end(fs.readFileSync(filename));
					}
					//console.log("Done sending file");
				} else {
					console.log("File not found: " + filename);
					res.setHeader("Content-Type", "text/plain");
					res.end("File Not Found.");
				}
			} else if (module_holder[moduleName] != null) {
				//console.log("Module " + moduleName + ", function GET_" + functionName);
				
				var dataTemp = "";
				module_holder[moduleName].removeAllListeners('data').on('data', function (data) {
					//res.write(JSON.stringify(data));
					dataTemp += data;
				});
				module_holder[moduleName].removeAllListeners('end').on('end', function (data) {
					//console.log("GET Operation complete, sending response to client: " + JSON.stringify(dataTemp + data));
					res.end(JSON.stringify(dataTemp + data));
				});
				module_holder[moduleName].removeAllListeners('stream').on('stream', function (str, hdrs, code) {
					res.writeHead(code, hdrs);
					str.pipe(res);
				});
				var data = module_holder[moduleName]["GET_" + functionName](workerData[moduleName]);
				if (data != null) {
					//console.log("GET Returned a value, sending response to client: " + JSON.stringify(data));
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
	};
	
	console.log("Setting up options");
	var options = {
		key: fs.readFileSync('./certs/server.key'),
		cert: fs.readFileSync('./certs/server.crt'),
		ca: LoadCerts("./certs/certificates"),
		requestCert: true,
		rejectUnauthorized: false
	};
	var authlist = " " + fs.readFileSync("./certs/authorized_users");
	console.log("Done setting up options");
	
	// Make an http server
	var server = https.createServer(options, function (req, res) {
		var readOnly = true;
		var clientCertificate = req.connection.getPeerCertificate();
		var username = "HTTPS User";
		if (req.client.authorized) {
			username = clientCertificate.subject.CN[0];
			var useremail = clientCertificate.subject.CN[1].substr(4);
			if (authlist.search(username) > 0 || authlist.search(useremail) > 0) {
				readOnly = false;
			}
		}
		
		try {
			serve(req, res, readOnly, username);
		} catch (e) {
			console.trace("Unhandled error in serve: " + JSON.stringify(e));
		}
	});
	var insecureServer = http.createServer(function (req, res) {
		//     serve( req,res,true,"HTTP User" );
		try {
			serve(req, res, false, "HTTP User");
		} catch (e) {
			console.trace("Unhandled error in serve: " + JSON.stringify(e));
		}
	});
	
	var baseport = 8080;
	if (__dirname.search("dev") >= 0) {
		baseport = 9090;
	}
	console.log("Listening on ports " + baseport + " and " + (baseport + 1));
	server.listen(baseport + 1);
	insecureServer.listen(baseport);
}
