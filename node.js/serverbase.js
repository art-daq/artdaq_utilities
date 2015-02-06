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

var cluster = require( 'cluster' );
var numCPUs = require( "os" ).cpus( ).length;
var fs = require( 'fs' );
var path_module = require( 'path' );
var module_holder = {};
var workerData = {};

var util = require( 'util' );
var log_file = fs.createWriteStream( __dirname + '/server.log',{ flags : 'a' } );
var log_stdout = process.stdout;

console.log = function ( d ) { //
    log_file.write( util.format( d ) + '\n' );
    log_stdout.write( util.format( d ) + '\n' );
};

// Sub-Module files
// From: http://stackoverflow.com/questions/10914751/loading-node-js-modules-dynamically-based-on-route
function LoadModules( path ) {
    var stat = fs.lstatSync( path );
    if ( stat.isDirectory( ) ) {
        // we have a directory: do a tree walk
        var files = fs.readdirSync( path );
        var f, l = files.length;
        for ( var i = 0; i < l; i++ ) {
            f = path_module.join( path,files[i] );
            LoadModules( f );
        }
    } else if ( path.search( "_module.js" ) > 0 && path.search( "js~" ) < 0 ) {
        console.log( "Loading Submodule " + path );
        // we have a file: load it
        require( path )( module_holder );
        console.log( "Initialized Submodule " + path );
    }
}
var DIR = path_module.join( __dirname,"modules" );
LoadModules( DIR );

// Node.js by default is single-threaded. Start multiple servers sharing
// the same port so that an error doesn't bring the whole system down
if ( cluster.isMaster ) {
    
    function messageHandler( msg ) {
        //console.log("Got Message from worker!");
        workerData = msg;
        Object.keys( cluster.workers ).forEach( function ( id ) {
            cluster.workers[id].send( workerData );
        } );
    }
    
    // Call Master Init functions
    for ( var name in module_holder ) {
        module_holder[name].MasterInitFunction( workerData );
    }
    fs.createWriteStream( __dirname + '/server.log',{ flags : 'w' } );
    
    cluster.on( 'online',function ( worker ) {
        worker.send( workerData );
    } );
    
    // Start workers for each CPU on the host
    for ( var i = 0; i < numCPUs; i++ ) {
        var worker = cluster.fork( );
        worker.on( 'message',messageHandler );
    }
    
    // If one dies, start a new one!
    cluster.on( "exit",function ( worker,code,signal ) {
        var newWorker = cluster.fork( );
        newWorker.on( 'message',messageHandler );
    } );
} else {
    // Node.js framework "includes"
    var https = require( 'https' );
    var http = require( 'http' );
    var url = require( 'url' );
    var qs = require( 'querystring' );
    
    process.on( 'message',function ( data ) {
        workerData = data;
    } )
    
    for ( var name in module_holder ) {
        module_holder[name].on( "message",function ( data ) {
            workerData[name] = data;
            process.send( workerData );
        } );
    }
    
    function serve( req,res,readOnly,username ) {
        // req is the HTTP request, res is the response the server will send
        // pathname is the URL after the http://host:port/ clause
        var pathname = url.parse( req.url,true ).pathname;
        if ( pathname[0] === '/' ) {
            pathname = pathname.substr( 1 );
        }
        
        var moduleName = pathname.substr( 0,pathname.indexOf( '/' ) );
        var functionName = pathname.substr( pathname.indexOf( '/' ) + 1 );
        
        var dnsDone = false;
        var peerName = require( 'dns' ).reverse( req.connection.remoteAddress,function ( err,domains ) {
            dnsDone = true;
            if ( !err ) {
                if ( functionName.search( ".min.map" ) < 0 ) {
                    console.log( "Recieved " + req.method + ", Client: " + domains[0] + " [" + req.connection.remoteAddress + "], PID: " + process.pid + " Module: " + moduleName + ", function: " + functionName );
                }
                return domains[0];
            } else {
                if ( functionName.search( ".min.map" ) < 0 ) {   
                    console.log( "Recieved " + req.method + ", Client: " + req.connection.remoteAddress + ", PID: " + process.pid + " Module: " + moduleName + ", function: " + functionName );
                }
                return "";
            }
        } );
        
        res.setHeader( "Content-Type","application/json" );
        res.statusCode = 200;
        // Log to console...
        //console.log("Recieved " + req.method + " for " + pathname);
        //console.log("Proceeding...");
        
        // If we're recieving a POST to /runcommand (As defined in the module),
        // handle that here
        if ( req.method === "POST" ) {
            var body = "";
            
            // Callback for request data (may come in async)
            req.on( 'data',function ( data ) {
                body += data;
            } );
            
            req.on( 'end',function () {
                // Get the content of the POST request 
                var POST = qs.parse( body );
                POST.who = username;
                
                if ( module_holder[moduleName] != null ) {
                    console.log( "Module " + moduleName + ", function " + functionName + " accessType " + ( readOnly ? "RO" : "RW" ) );
                    var dataTemp = "";
                    module_holder[moduleName].removeAllListeners( 'data' ).on( 'data',function ( data ) {
                        //res.write(JSON.stringify(data));
                        dataTemp += data;
                    } );
                    module_holder[moduleName].removeAllListeners( 'end' ).on( 'end',function ( data ) {
                        //console.log("Sending Message!");
                        process.send( workerData );
                        res.end( JSON.stringify( dataTemp + data ) );
                    } );
                    if ( readOnly ) {
                        try {
                            var data = module_holder[moduleName]["RO_" + functionName]( POST,workerData[moduleName] );
                            if ( data != null ) {
                                res.end( JSON.stringify( data ) );
                            }
                        } catch ( err ) {
                            if ( err instanceof TypeError ) {
                                console.log( "Unauthorized access attempt: " + username + ": " + moduleName + "/" + functionName );
                                res.end( JSON.stringify( null ) );
                            }
                        }
                    } else {
                        try {
                            var data = module_holder[moduleName]["RW_" + functionName]( POST,workerData[moduleName] );
                            if ( data != null ) {
                                res.end( JSON.stringify( data ) );
                                //console.log("Sending Message!");
                                process.send( workerData );
                            }
                        } catch ( err ) {
                            if ( err instanceof TypeError ) {
                                //RW_ version not available, try read-only version:
                                var data = module_holder[moduleName]["RO_" + functionName]( POST,workerData[moduleName] );
                                if ( data != null ) {
                                    res.end( JSON.stringify( data ) );
                                }
                            }
                        }
                    }
                } else {
                    console.log( "Unknown POST URL: " + pathname );
                    res.writeHeader( 404,{ 'Content-Type': 'text/html' } );
                    res.end( "Error" );
                }
            } );
        }
        //We got a GET request!
        if ( req.method === "GET" || req.method === "HEAD" ) {
            //console.log(req.headers);
            if ( functionName.indexOf( "." ) > 0 ) {
                //console.log("Client File Access Requested");
                var ext = functionName.substr( functionName.lastIndexOf( "." ) + 1 );
                res.setHeader( "Content-Type","text/plain" );
                //console.log("Extension: " + ext);
                switch ( ext ) {
                    case "css":
                        res.setHeader( "Content-Type","text/css" );
                        break;
                    case "js":
                        res.setHeader( "Content-Type","text/javascript" );
                        break;
                    case "html":
                        res.setHeader( "Content-Type","text/html" );
                        break;
                    case "htm":
                        res.setHeader( "Content-Type","text/html" );
                        break;
                    case "root":
                        res.setHeader( "Content-Type","application/root+root.exe" );
                        break;
                    case "gif":
                        res.setHeader( "Content-Type","image/gif" );
                        break;
                }
                
                var filename = "./modules/" + moduleName + "/client/" + functionName;
                if ( fs.existsSync( filename ) ) {
                    res.setHeader( "Content-Length",fs.statSync( filename )["size"] );
                    if ( req.headers.range != null ) {
                        var range = req.headers.range;
                        var fd = fs.openSync( filename,'r' );
                        var offset = parseInt( range.substr( range.indexOf( '=' ) + 1,range.indexOf( '-' ) - ( range.indexOf( '=' ) + 1 ) ) );
                        var endOffset = parseInt( range.substr( range.indexOf( '-' ) + 1 ) );
                        console.log( "Reading (" + offset + ", " + endOffset + ")" );
                        
                        res.setHeader( "Content-Length",( endOffset - offset + 1 ).toString( ) );
                        var readStream = fs.createReadStream( filename,{ start: parseInt( offset ), end: parseInt( endOffset ) } );
                        readStream.pipe( res );
                    } else {
                        res.end( fs.readFileSync( filename ) );
                    }
                    //console.log("Done sending file");
                } else {
                    console.log( "File not found: " + filename );
                    res.setHeader( "Content-Type","text/plain" );
                    res.end( "File Not Found." );
                }
            } else if ( module_holder[moduleName] != null ) {
                //console.log("Module " + moduleName + ", function GET_" + functionName);
                
                var dataTemp = "";
                module_holder[moduleName].removeAllListeners( 'data' ).on( 'data',function ( data ) {
                    //res.write(JSON.stringify(data));
                    dataTemp += data;
                } );
                module_holder[moduleName].removeAllListeners( 'end' ).on( 'end',function ( data ) {
                    res.end( JSON.stringify( dataTemp + data ) );
                } );
                var data = module_holder[moduleName]["GET_" + functionName]( workerData[moduleName] );
                if ( data != null ) {
                    res.end( JSON.stringify( data ) );
                }
            } else {
                console.log( "Sending client.html" );
                // Write out the frame code
                res.setHeader( "Content-Type","text/html" );
                res.end( fs.readFileSync( "./client.html" ),'utf-8' );
                console.log( "Done sending client.html" );
            }
        }
    }
    
    console.log( "Setting up options" );
    var options = {
        key: fs.readFileSync( './certs/server.key' ),
        cert: fs.readFileSync( './certs/server.crt' ),
        ca: fs.readFileSync( './certs/ca.crt' ),
        requestCert: true,
        rejectUnauthorized: false
    };
    var k5login = " " + fs.readFileSync( process.env.HOME + "/.k5login" );
    console.log( "Done setting up options" );
    
    // Make an http server
    var server = https.createServer( options,function ( req,res ) {
        var readOnly = true;
        var clientCertificate = req.connection.getPeerCertificate( );
        var username = "HTTPS User";
        if ( req.client.authorized ) {
            username = clientCertificate.subject.CN[0];
            var useremail = clientCertificate.subject.CN[1].substr( 4 );
            var userFNAL = useremail + "@FNAL.GOV";
            var userWIN = useremail + "@FERMI.WIN.FNAL.GOV";
            if ( k5login.search( userFNAL ) >= 0 || k5login.search( userWIN ) >= 0 ) {
                readOnly = false;
            }
        }
        serve( req,res,readOnly,username );
    } );
    var insecureServer = http.createServer( function ( req,res ) {
        serve( req,res,true,"HTTP User" );
    } );
    
    var baseport = 8080;
    if ( __dirname.search( "dev" ) >= 0 ) {
        baseport = 9090;
    }
    console.log( "Listening on ports " + baseport + " and " + ( baseport + 1 ) );
    server.listen( baseport + 1 );
    insecureServer.listen( baseport );
}
