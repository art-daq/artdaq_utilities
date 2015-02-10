
var emitter = require( 'events' ).EventEmitter;
var fs = require( 'fs' );
var ac = new emitter( );
var path = require( 'path' );
var xml = require( 'xml2js' );
var parser = new xml.Parser( { explicitArray: false } );
var util = require( 'util' );

function generateDefaultConfig() {
    var output = {};
    output.expertMode = false;
    output.configName = "Default";
    output.artdaqDir = "~/artdaq-demo-base";
    output.setupScript = "setupARTDAQDEMO";
    output.needsRestart = false;
    output.dataDir = "/tmp";
    output.logDir = "/tmp";
    output.dataLogger = {};
    output.dataLogger.enabled = true;
    output.dataLogger.fileValue = 0;
    output.dataLogger.fileMode = "Events";
    output.dataLogger.runValue = -1;
    output.dataLogger.runMode = "Events";
    output.dataLogger.hostname = "localhost"
    output.dataLogger.name = "DataLogger"
    output.onlineMonitor = {};
    output.onlineMonitor.enabled = true;
    output.onlineMonitor.viewerEnabled = false;
    output.onlineMonitor.hostname = "localhost"
    output.onlineMonitor.name = "OnlineMonitor"
    output.eventBuilders = {};
    output.eventBuilders.basename = "EVB";
    output.eventBuilders.count = 2;
    output.eventBuilders.compress = false;
    output.eventBuilders.hostnames = ["localhost","localhost"];

    return output;
}

function traverse( obj, parent ) {
    var output = "";
    //console.log( "Traversing: " )
    //console.log( obj );
    for ( var key in obj ) {
        var keyPrint = key;
        if ( key.length == 1 && parseInt( key ) >= 0 ) {
            keyPrint = parent.slice( 0,parent.length - 1 );
        }
        if ( obj.hasOwnProperty( key ) ) {
            //console.log( "Key is " + keyPrint );
            output += "<" + keyPrint + ">";
            if ( obj[key] !== null && typeof ( obj[key] ) === "object" ) {
                //console.log( "Going to traverse " + key + " with data:" );
                //console.log( obj[key] );
                output += "\n" + traverse( obj[key], key );
            } else {
                //console.log( "Filling in key value " + obj[key] );
                output += obj[key];
            }
            //console.log( "Ending key " + keyPrint );
            output += "</" + keyPrint + ">\n";
        }
    }
    //console.log( "Returning " + output );
    return output;
}

function serializeXML( config,who,fileName ) {
    console.log( "Saving Configuration to " + fileName );
    var xmlData = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
    
    var configurationXML = "<author>" + who + "</author>\n"
    configurationXML += traverse( config, "" );
    
    console.log( "Putting Generated configuration into artdaq-configuration block" )
    xmlData += "<artdaq-configuration>\n" + configurationXML + "</artdaq-configuration>";
    
    console.log( "Writing out file" );
    fs.writeFileSync( fileName,xmlData );
    console.log( "Done Writing Configuration" );
    return true;
}

function checkBools( object ) {
    for ( var key in object ) {
        if ( object.hasOwnProperty( key ) ) {
            if ( object[key] === "true" ) {
                object[key] = true;
            } else if ( object[key] === "false" ) {
                object[key] = false;
            } else if ( object !== null && typeof ( object ) === "object" ) {
                object[key] = checkBools( object[key] );
            }
        }
    }
    return object;
}

function deserializeXML( fileName ) {
    console.log( "Reading " + fileName + ":" );
    var xmlData = fs.readFileSync( fileName );
    var xmlObj;
    parser.parseString( xmlData,function ( err,result ) { xmlObj = result; } );
    //console.log( util.inspect( xmlObj,false,null ) );
    output = {};
    output.artdaqDir = xmlObj['artdaq-configuration'].artdaqDir;
    output.expertMode = xmlObj['artdaq-configuration'].expertMode;
    output.configName = xmlObj['artdaq-configuration'].configName;
    output.dataDir = xmlObj['artdaq-configuration'].dataDir;
    output.logDir = xmlObj['artdaq-configuration'].logDir;
    output.setupScript = xmlObj['artdaq-configuration'].setupScript;
    output.dataLogger = xmlObj['artdaq-configuration'].dataLogger;
    output.onlineMonitor = xmlObj['artdaq-configuration'].onlineMonitor;
    output.eventBuilders = xmlObj['artdaq-configuration'].eventBuilders;
    output.eventBuilders.hostnames = xmlObj['artdaq-configuration'].eventBuilders.hostnames.hostname;
    output.boardReaders = xmlObj['artdaq-configuration'].boardReaders.boardReader;
    
    return checkBools( output );
}

ac.MasterInitFunction = function ( workerData ) {
    workerData["artdaq-configuration"] = "ac";
};

function getFiles( mask,dir ) {
    dir = typeof ( dir ) !== 'undefined' ? dir : __dirname;
    
    console.log( "Directory is " + dir + ", and mask is " + mask );
    var output = [];
    var files = fs.readdirSync( dir );
    var f, l = files.length;
    for ( var i = 0; i < l; i++ ) {
        f = files[i].toString( );
        if ( f.search( mask ) > 0 ) {
            var cfgName = f.substring( 0,f.indexOf( mask ) );
            console.log( "Found file satisfying mask " + mask + ": " + f + " (" + cfgName + ")" );
            output.push( "<option value=\"" + cfgName +mask+ "\">" + cfgName + "</option>" );
        }
    }
    return output;
}

ac.GET_Default = function () {
    return "";
}

ac.GET_GeneratorTypes = function () {
    var types = [];
    types.push( "<option value=\"Default\">No Generator Selected</option>" );
    types.push( "<optgroup label=\"Simulators\">" );
    types = types.concat( getFiles( "_simulator.html" ,__dirname + "/../client" ));
    types.push( "</optgroup>" );
    types.push( "<optgroup label=\"Recievers\">" );
    types = types.concat( getFiles( "_receiver.html" ,__dirname + "/../client" ));
    types.push( "</optgroup>" );
    types.push( "<optgroup label=\"Readers\">" );
    types = types.concat( getFiles( "_reader.html" ,__dirname + "/../client" ));
    types.push( "</optgroup>" );
    
    return types;
}

ac.GET_NamedConfigs = function () {
    var configs = getFiles( ".xml" );
    
    configs.push( "<option value=\"Default\">Default Configuration</option>" )
    if ( configs.length < 2 ) {
        console.log( "I found no named configs!" );

    }
    return configs;
};

ac.RW_saveConfig = function ( POST ) {
    var success = false;
    console.log( "Request to save configuration recieved. Configuration data:" );
    var config = JSON.parse( POST.config );
    
    success = serializeXML( config,POST.who,path.join( __dirname,config.configName + ".xml" ) );
    return { Success: success };
}

ac.RO_LoadNamedConfig = function ( POST ) {
    console.log( "Request for configuration with file name \"" + POST.configFile + "\" received." );
    if ( POST.configFile === "Default" ) {
        return generateDefaultConfig( );
    }
    var output = deserializeXML( path.join( __dirname,POST.configFile ) );
    console.log( "Deserialized XML:" );
    console.log( output );
    return output;
};

module.exports = function ( module_holder ) {
    module_holder["artdaq-configuration"] = ac;
};
