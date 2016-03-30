// db_module.js : Server-side bindings for DB Display module
// Author: Eric Flumerfelt, FNAL RSI
// Last Modified: October 30, 2015
//

// Node.js framework "includes"
// ReSharper disable PossiblyUnassignedProperty
var spawn = require("child_process").spawn;
var Emitter = require("events").EventEmitter;
var fs = require("fs");
var child_process = require("child_process");
var util = require("util");
var path_module = require("path");
var db = new Emitter();
var conftool;

try {
    var conftoolPath = path_module.join(process.env["ARTDAQ_DATABASE_LIB"], "node_modules", "conftoolg");
    console.log("Looking for conftoolg module in " + conftoolPath);
    conftool = require(conftoolPath);
    console.log("Module loaded.");
} catch (e) {
    console.log("Error loading conftoolg module...have you setup the artdaq_database product?");
    console.log(e);
}
// ReSharper restore PossiblyUnassignedProperty


var config = {
    dbprovider: "filesystem",
    configNameFilter: ""
};

var defaultColumns = {
    columns: [
        {
            name: "name",
            type: "string",
            editable: false,
            display: true
        },
        {
            name: "value",
            type: "string",
            editable: true,
            display: true
        },
        {
            name: "annotation",
            title: "User Comment",
            type: "string",
            editable: true,
            display: true
        },
        {
            name: "comment",
            type: "comment",
            editable: false,
            display: false
        },
        {
            name: "type",
            type: "string",
            editable: false,
            display: false
        },
        {
            name: "values",
            type: "array",
            editable: false,
            display: false
        }
    ],
    comment: "comment"
};

/**
 * Runs a findconfigs query against the database
 * @param {string} dbDirectory - The database temporary directory
 * @returns {Object} JSON object returned by the database 
 */
function RunGetConfigsQuery(dbDirectory) {
    console.log("Running findconfigs query");
    var query = {
        filter: {},
        dbprovider: config.dbprovider,
        operation: "findconfigs",
        dataformat: "gui"
    };
    if (config.configNameFilter.length > 0) {
        if (config.dbprovider === "mongo") {
            query.filter = {
                "configurations.name": {
                    "$regex": config.configNameFilter
                }
            };
        } else {
            query.filter = {
                "configurations.name": config.configNameFilter
            };
        }
    }

    var queryFile = path_module.join(dbDirectory, "findconfigs.query.flt.json");
    fs.writeFileSync(queryFile, JSON.stringify(query));
    RunConfTool("findconfigs", path_module.join(dbDirectory, "findconfigs.db.gui.json"), queryFile);
    
    var retjson = "" + fs.readFileSync(path_module.join(dbDirectory, "findconfigs.db.gui.json"));
    var ret = JSON.parse(retjson);
    // console.log(retjson);
    return ret;
}

/**
 * Finds the entities currently present in the database
 * @param {string} dbDirectory - The database temporary directory
 * @returns {Object} JSON object returned by the database 
 */
function RunGetEntitiesQuery(dbDirectory) {
    console.log("Running findentities query");
    var query = {
        filter: {},
        dbprovider: config.dbprovider,
        operation: "findentities",
        dataformat: "gui"
    };
    
    var queryFile = path_module.join(dbDirectory, "findentities.query.flt.json");
    fs.writeFileSync(queryFile, JSON.stringify(query));
    RunConfTool("findentities", path_module.join(dbDirectory, "findentities.db.gui.json"), queryFile);
    
    var retjson = "" + fs.readFileSync(path_module.join(dbDirectory, "findentities.gui.json"));
    var ret = JSON.parse(retjson);
    // console.log(retjson);
    return ret;
}

/**
 * Runs the findversions query using the given entity query
 * @param {string} dbDirectory - Database temporary storage directory
 * @param {Object} query - The query to run (as returned by buildfilter)
 * @returns {Object} JSON object returned by the database
 */
function RunGetVersionsQuery(dbDirectory, query) {
    console.log("Running findversions query");
    var queryFile = path_module.join(dbDirectory, "findversions.query.flt.json");
    fs.writeFileSync(queryFile, JSON.stringify(query));
    
    RunConfTool("findversions", path_module.join(dbDirectory, "findversions.db.gui.json"), queryFile);
    
    var retjson = "" + fs.readFileSync(path_module.join(dbDirectory, "findversions.gui.json"));
    //console.log(retjson);
    return JSON.parse(retjson);
}

/**
 * Runs a buildfilter operation against the database
 * @param {string} configName - Name of the configuration
 * @param {string} dbDirectory - The database temporary directory
 * @returns {Object} JSON object returned by the database
 */
function RunBuildFilterQuery(configName, dbDirectory, queryIn) {
    var query = {};
    
    if (queryIn === undefined) {
        
        console.log("Getting query for " + configName);
        var configs = RunGetConfigsQuery(dbDirectory).search;
        for (var conf in configs) {
            if (configs.hasOwnProperty(conf)) {
                var config = configs[conf];
                if (config.name === configName) {
                    query = config.query;
                }
            }
        }
    } else {
        query = queryIn;
    }
    
    console.log("Running buildfilter query");
    var queryFile = path_module.join(dbDirectory, "buildfilter.query.flt.json");
    fs.writeFileSync(queryFile, JSON.stringify(query));
    
    RunConfTool("buildfilter", path_module.join(dbDirectory, "buildfilter.db.gui.json"), queryFile);
    
    var retjson = "" + fs.readFileSync(path_module.join(dbDirectory, "buildfilter.gui.json"));
    var ret = JSON.parse(retjson);
    // console.log(retjson);
    return ret;
}

/**
 * Creates a new configuration containing the given file versions
 * @param {Object} query - Query to run
 * @param {string} dbDirectory - Database temporary storage directory
 */
function RunNewConfigQuery(query, dbDirectory) {
    console.log("Running newconfig query: " + JSON.stringify(query));
    var queryFile = path_module.join(dbDirectory, "newconfig.query.flt.json");
    fs.writeFileSync(queryFile, JSON.stringify(query));
    
    RunConfTool("newconfig", path_module.join(dbDirectory, "newconfig.db.gui.json"), queryFile);
    console.log("DONE");
}

/**
 * Adds a configuration file to a configuration
 * @param {string} configName - Name of the configuration to modify
 * @param {string} version - Version of the new config file
 * @param {string} collectionName - Collection of new config file
 * @param {Object} entity - Entity information of new config file
 * @param {string} entity.name - Name of the configurable entity
 * @param {string} dbDirectory - Database temporary storage directory
 */
function RunAddConfigQuery(configName, version, collectionName, entity, dbDirectory) {
    console.log("RunAddConfigQuery: configName: " + configName, ", version: " + version + ", collectionName: " + collectionName + ", entity: " + JSON.stringify(entity));
    var query = {
        filter: {
            "configurable_entity.name": entity.name,
            "version": version
        },
        collection: collectionName,
        configuration: configName,
        dbprovider: config.dbprovider,
        operation: "addconfig",
        dataformat: "gui"
    };
    var queryFile = path_module.join(dbDirectory, "addconfig.query.flt.json");
    fs.writeFileSync(queryFile, JSON.stringify(query));
    
    RunConfTool("addconfig", path_module.join(dbDirectory, "addconfig.db.gui.json"), queryFile);
    console.log("DONE");
}

/**
 * Stores a configuration file to the database.
 * @param {string} fileName - JSON file containing data to be inserted
 * @param {string} configName - Name of the configuration to add this entity
 * @param {string} collectionName - Collection to which this entity belongs
 * @param {string} version - Version of the configuration file
 * @param {string} entity - Name of the entity configured by this file
 * @param {string} dbDirectory - Database temporary storage directory
 */
function RunStoreConfigQuery(fileName, configName, collectionName, version, entity, dbDirectory) {
    
    console.log("RunStoreConfigQuery: fileName: " + fileName + ", configName: " + configName + ", collectionName: " + collectionName + ", version: " + version + ", entity: " + JSON.stringify(entity));
    var query = {
        filter: {
            "configurable_entity.name": entity.name,
            "configurations.name": configName
        },
        collection: collectionName,
        configurable_entity: entity,
        configuration: configName,
        dbprovider: config.dbprovider,
        operation: "store",
        dataformat: "gui"
    };
    var queryFile = path_module.join(dbDirectory, "store.query.flt.json");
    fs.writeFileSync(queryFile, JSON.stringify(query));
    
    RunConfTool("store", path_module.join(dbDirectory, fileName), queryFile);
    console.log("DONE");
}

/**
 * Loads a configuration file from the database
 * @param {Object} query - The query to run (as returned by buildfilter)
 * @param {string} filebase - Name of the output file (will be given .gui.json extension)
 * @param {string} dbDirectory - Database temporary storage directory
 * @returns {Object} JSON object returned by the database
 */
function RunLoadConfigQuery(query, filebase, dbDirectory) {
    console.log("Running load query");
    var queryFile = path_module.join(dbDirectory, "load.query.flt.json");
    fs.writeFileSync(queryFile, JSON.stringify(query));
    
    RunConfTool("load", path_module.join(dbDirectory, filebase + ".db.gui.json"), queryFile);
    
    var retjson = "" + fs.readFileSync(path_module.join(dbDirectory, filebase + ".gui.json"));
    //console.log(retjson);
    return JSON.parse(retjson);
}

/**
 * Searches a string array for a given value
 * @param {string[]} arr - Array to search
 * @param {string} val - Value to search for
 * @returns {Number} Index of value in array (-1 for no match)
 */
function ContainsString(arr, val) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i].search(val) >= 0) {
            return i;
        }
    }
    return -1;
}

/**
 * Searches an array of objects for one which has the given value for a given property
 * @param {Object[]} arr - Array of objects to search
 * @param {Object} val - Value being searched for
 * @param {string} name - Property name to search
 * @returns {Number} Index of object matching search (-1 for no match) 
 */
function ContainsName(arr, val, name) {
    for (var i = 0; i < arr.length; i++) {
        //console.log("Checking if " + arr[i][name] + " is equal to " + val);
        if (arr[i][name] === val) {
            return i;
        }
    }
    return -1;
}

/**
 * Transforms FHiCL sequences into arrays of objects for display by GUI editor
 * @param {Object} sequence - Sequence object
 * @param {Object[]} sqeuence.values - Array of data stored in the sequence
 * @returns {Object} Sqeuence object after transform
 */
function ParseSequence(sequence) {
    //console.log("SEQUENCE BEFORE: " + JSON.stringify(sequence));
    if (sequence.values) {
        for (var i = 0; i < sequence.values.length; ++i) {
            var name = sequence.name + "_" + i;
            var value = sequence.values[i];
            sequence.values[i] = { name: name, value: value };
        }
    }
    //console.log("SEQUENCE AFTER: " + JSON.stringify(sequence));
    return sequence;
}

/**
 * Fills the "hasSubtables" variable for each table object. Creates "Table Entries" tables so that no table contains both subtables and values.
 * @param {Object} table - FHiCL table data to parse
 * @param {Number} sub - Dummy variable to limit debug output to final return statement only
 * @returns {Object} Converted FHiCL data 
 */
function ParseFhiclTable(table, sub) {
    var children = [];
    var atoms = [];
    var hasSubtables = false;
    var comment = table.comment ? table.comment : "";
    //console.log("Table name is " + name);
    
    for (var e in table.children) {
        if (table.children.hasOwnProperty(e)) {
            var element = table.children[e];
            //console.log("Element: " + JSON.stringify(element));
            switch (element.type) {
                case "table":
                    //console.log("Parsing table " + e);
                    hasSubtables = true;
                    children.push(ParseFhiclTable(element, 1));
                    break;
                case "sequence":
                    atoms.push(ParseSequence(element));
                    break;
                case "number":
                case "string":
                case "bool":
                    atoms.push(element);
                    break;
                default:
                    console.log("Unknown type " + element.type + " encountered!");
                    break;
            }
        }
    }
    var newTable;
    var atom;
    if (atoms.length > 0 && children.length > 0) {
        newTable = {};
        newTable.children = [];
        newTable.hasSubtables = false;
        newTable.type = "table";
        newTable.name = "Table Entries";
        newTable.comment = table.comment;
        
        for (atom in atoms) {
            if (atoms.hasOwnProperty(atom)) {
                newTable.children.push(atoms[atom]);
            }
        }
        children.push(newTable);
    } else if (atoms.length > 0) {
        for (atom in atoms) {
            if (atoms.hasOwnProperty(atom)) {
                children.push(atoms[atom]);
            }
        }
    }
    
    if (children.length > 0) {
        for (var i in children) {
            if (children.hasOwnProperty(i) && children[i].hasSubtables) {
                if (children[i].children.length === 1 && children[i].children[0].name === "Table Entries") {
                    newTable = JSON.parse(JSON.stringify(children[i].children[0]));
                    newTable.name = children[i].name;
                    newTable.comment = children[i].comment;
                    newTable.type = children[i].type;
                    newTable.hasSubtables = false;

                }
            }
        }
    }
    
    var obj = { name: table.name, hasSubtables: hasSubtables, children: children, type: "table", comment: comment };
    if (sub === 0 || sub === undefined) {
        //console.log("Returning: " + JSON.stringify(obj));
    }
    return obj;
}

/**
 * Reads a .gui.json file and performs conversion for sending to the client
 * @param {string} path - Name of the file to load
 * @param {string} name - Display name of this configuration object
 * @param {Object} dirs - Object containing paths to important directories
 * @param {string} dirs.tmp - The temporary directory for this editing session
 * @param {string} dirs.db - The database temporary storage directory
 * @returns {Object} Converted FHiCL data
 */
function ParseFhicl(path, name, dirs) {
    var fileName = path_module.join(dirs.db, path);
    if (fs.existsSync(path_module.join(dirs.tmp, path))) {
        fileName = path_module.join(dirs.tmp, path);
    }
    console.log("Going to load FhiCL file: " + fileName);
    var fcl = JSON.parse("" + fs.readFileSync(fileName));
    //console.log(JSON.stringify(fcl));
    return ParseFhiclTable({ children: fcl.document.converted.guidata, name: name }, 0);
}

/**
 * Returns the list of files present in a configuration
 * @param {string} configName - Name of the configuration to load
 * @param {Object} dirs - Object containing paths to important directories
 * @param {string} dirs.tmp - The temporary directory for this editing session
 * @param {string} dirs.db - The database temporary storage directory
 * @returns {Object} {}.files contains the names of the files
 */
function GetConfigFiles(configName, dirs, query) {
    var configFiles = RunBuildFilterQuery(configName, dirs.db, query).search;
    var retval = {
        files: []
    };
    for (var file in configFiles) {
        if (configFiles.hasOwnProperty(file)) {
            console.log("File info: " + JSON.stringify(configFiles[file]));
            RunLoadConfigQuery(configFiles[file].query, configFiles[file].name, dirs.db);
            retval.files.push(configFiles[file].name);
        }
    }
    return retval;
}

/**
 * Returns a table from a configuration
 * @param {string} configPath - Name of the configuration
 * @param {string} tablePath - Path to the table, unix style (Config File Name/path/to/table)
 * @param {Object} dirs - Object containing paths to important directories
 * @param {string} dirs.tmp - The temporary directory for this editing session
 * @param {string} dirs.db - The database temporary storage directory
 * @returns {string} JSON representation of table 
 */
function GetData(configPath, tablePath, dirs) {
    console.log("Searching for Table " + tablePath + " from configuration " + configPath);
    var path = tablePath.split("/");
    var filebase = path.shift();
    var fileName = path_module.join(dirs.db, filebase + ".gui.json");
    if (fs.existsSync(path_module.join(dirs.tmp, filebase + ".gui.json"))) {
        fileName = path_module.join(dirs.tmp, filebase + ".gui.json");
    }
    var jsonFile = JSON.parse("" + fs.readFileSync(fileName));
    var jsonBase = ParseFhiclTable({ children: jsonFile.document.converted.guidata, name: filebase }, 0);
    
    while (path.length > 1) {
        var index = ContainsName(jsonBase.children, path[0], "name");
        //console.log("index is " + index);
        jsonBase = jsonBase.children[index];
        path.shift();
    }
    
    var table = ContainsName(jsonBase.children, path[0], "name");
    //console.log("Index of table with name " + path[0] + " is " + table);
    if (table >= 0) {
        var obj = {};
        obj.data = jsonBase.children[table];
        obj.columns = defaultColumns.columns;
        obj.comment = defaultColumns.comment;
        var str = JSON.stringify(obj);
        // console.log("Returning: " + str);
        return str;

    }
    
    return "{}";
}

/**
 * Saves a change from UpdateTable to a temporary file on disk.
 * @param {string} configPath - Name of the Configuration
 * @param {string} tablePath - Path to the table, unix style (Config File Name/path/to/table)
 * @param {string} table - Modified table data
 * @param {Object} dirs - Object containing paths to important directories
 * @param {string} dirs.tmp - The temporary directory for this editing session
 * @param {string} dirs.db - The database temporary storage directory
 */
function SetTable(configPath, tablePath, table, dirs) {
    console.log("SetTable: Searching for Table " + tablePath);
    var path = tablePath.split("/");
    var filebase = path.shift(); // Get rid of filename for now
    
    var fileName = path_module.join(dirs.db, filebase + ".gui.json");
    if (fs.existsSync(path_module.join(dirs.tmp, filebase + ".gui.json"))) {
        fileName = path_module.join(dirs.tmp, filebase + ".gui.json");
    }
    var jsonFile = JSON.parse("" + fs.readFileSync(fileName));
    var fileTable = jsonFile.document.converted.guidata;
    var refs = [];
    var index;
    if (path.length > 0 && path[0] !== "Table Entries") {
        //console.log("fileTable is " + JSON.stringify(fileTable));
        index = ContainsName(fileTable, path[0], "name");
        refs.push({ ref: fileTable, index: index, first: true });
        fileTable = fileTable[index];
        path.shift();
    }
    
    while (path.length > 0 && path[0] !== "Table Entries") {
        //console.log("fileTable is " + JSON.stringify(fileTable));
        index = ContainsName(fileTable.children, path[0], "name");
        refs.push({ ref: fileTable, index: index, first: false });
        fileTable = fileTable.children[index];
        path.shift();
    }
    if (path[0] === "Table Entries") {
        for (var entry in table.children) {
            if (table.children.hasOwnProperty(entry)) {
                index = ContainsName(fileTable.children, table.children[entry].name, "name");
                //console.log("Index of property " + table.children[entry].name + " in " + JSON.stringify(fileTable.children) + " is " + index);
                fileTable.children[index] = table.children[entry];
            }
        }
    } else {
        fileTable = table;
    }
    
    for (var i = refs.length - 1; i >= 0; --i) {
        if (!refs[i].first) {
            refs[i].ref.children[refs[i].index] = fileTable;
            fileTable = refs[i].ref;
        } else {
            refs[i].ref[refs[i].index] = fileTable;
            fileTable = refs[i].ref;
        }
    }
    jsonFile.document.converted.guidata = fileTable;
    //console.log("Output: " + JSON.stringify(jsonFile.document.converted.guidata));
    fs.writeFileSync(path_module.join(dirs.tmp, filebase + ".gui.json"), JSON.stringify(jsonFile));
}

/**
 * Updates a value in a table and calles SetTable to save changes to disk
 * @param {string} configPath - Name of the Configuration
 * @param {string} tablePath - Path to the table, unix style (Config File Name/path/to/table)
 * @param {string} data - Modified value data
 * @param {Object} dirs - Object containing paths to important directories
 * @param {string} dirs.tmp - The temporary directory for this editing session
 * @param {string} dirs.db - The database temporary storage directory
 */
function UpdateTable(configPath, tablePath, data, dirs) {
    var file = GetData(configPath, tablePath, dirs);
    //console.log("Table data is " + file);
    var oldData = JSON.parse(file).data;
    
    console.log("Searching table for entry");
    for (var entryN in oldData.children) {
        if (oldData.children.hasOwnProperty(entryN)) {
            var entry = oldData.children[entryN];
            var index = data.name.search(entry.name);
            //console.log("Checking if " + data.name + " contains " + entry.name + " (" + index + ")");
            if (index === 0) {
                if (data.name === entry.name) {
                    console.log("Setting " + JSON.stringify(entry) + " field " + data.column + " to " + data.value);
                    if (entry.type === "number") {
                        data.value = parseInt(data.value);
                    }
                    entry[data.column] = data.value;
                } else {
                    //Check for Fhicl Sequence:
                    var values = entry.values;
                    for (var element in values) {
                        if (values.hasOwnProperty(element)) {
                            console.log("SEQUENCE: Checking if " + values[element].name + " is equal to " + data.name);
                            if (values[element].name === data.name) {
                                console.log("Setting " + values[element] + " field " + data.column + " to " + data.value);
                                values[element][data.column] = data.value;
                            }
                        }
                    }
                }
            }
        }
    }
    
    //console.log("After replacement, table data is " + JSON.stringify(oldData));
    SetTable(configPath, tablePath, oldData, dirs);
}

/**
 * Checks that a path only contains alphanumeric characters, hyphens and underscores
 * @param {string} path - Path to check for invalid characters
 * @returns {Boolean} If the path is okay
 */
function ValidatePath(path) {
    var re = /^[a-zA-Z0-9\-_]+$/;
    if (!path.match(re)) {
        return false;
    }
    
    return true;
}

/**
 * Removes a user's temporary directory, not saving changes to the database
 * @param {string[]} files - List of files to discard
 * @param {Object} dirs - Object containing paths to important directories
 * @param {string} dirs.tmp - The temporary directory for this editing session
 * @param {string} dirs.db - The database temporary storage directory
 * @param {string} dirs.trash - The directory to hold discarded configuration changes
 * @returns {Boolean} True when complete 
 */
function DiscardWorkingDir(files, dirs) {
    console.log("Discarding changed files: " + JSON.stringify(files));
    for (var file in files) {
        if (files.hasOwnProperty(file)) {
            var path = files[file].name;
            
            var trashPath = path_module.join(dirs.trash, path + "_" + Date.now() + ".gui.json");
            var tempPath = path_module.join(dirs.tmp, path + ".gui.json");
            console.log("trashPath: " + trashPath + ", tempPath: " + tempPath);
            
            
            if (!fs.existsSync(tempPath)) {
                console.log(path + ": No changes detected, continuing");
                continue;
            }
            
            console.log("Moving config to trash: " + tempPath + " to " + trashPath);
            fs.renameSync(tempPath, trashPath);
        }
    }
    console.log("Returning...");
    return true;
}

/**
 * Runs a command in a child process and waits for completion
 * @param {string} command - Command to run
 * @returns {string} Command Output 
 */
function execSync(command) {
    // Run the command in a subshell
    child_process.exec(command + " 2>&1 1>output && echo done! > done");
    
    // Block the event loop until the command has executed.
    while (!fs.existsSync("done")) {
// Do nothing
    }
    
    // Read the output
    var output = fs.readFileSync("output");
    
    // Delete temporary files.
    fs.unlinkSync("output");
    fs.unlinkSync("done");
    
    return output;
}

/**
 *  Moves a file from oldPath to newPath
 * @param {string} oldPath - Old path for file
 * @param {string} newPath - New path for file
 */
function move(oldPath, newPath) {
    if (fs.existsSync(newPath)) {
        fs.unlinkSync(newPath);
    }
    
    fs.renameSync(oldPath, newPath);
}

/**
 * Copies a file from oldPath to newPath
 * @param {string} oldPath - Old path for file
 * @param {string} newPath - New path for file
 */
function copy(oldPath, newPath) {
    execSync("cp -a \"" + oldPath + "\" \"" + newPath + "\"");
}

/**
 * Removes a directory and all subdirectories
 * @param {string} path - Path to remove
 */
function rmrf(path) {
    if (ValidatePath(path)) {
        execSync("rm -rf \"" + path + "\"");
    }
}

/**
 * Creates a new configuration containing all modifications to the old configuration plus any unmodified files.
 * @param {string} oldConfig - Name of the old configuration
 * @param {string} newConfig - Name of the new configuration
 * @param {string[]} files - List of modified files
 * @param {Object} dirs - Object containing paths to important directories
 * @param {string} dirs.tmp - The temporary directory for this editing session
 * @param {string} dirs.db - The database temporary storage directory
 * @param {string} dirs.trash - The directory to hold discarded configuration changes
 * @returns {Boolean} True when done 
 */
function SaveConfigurationChanges(oldConfig, newConfig, files, dirs) {
    console.log("Saving Configuration Changes, oldConfig: " + oldConfig + ", newConfig: " + newConfig + ", files: " + JSON.stringify(files));
    var fileInfo = RunBuildFilterQuery(oldConfig, dirs.db).search;
    
    var originalMetadata;
    var f;
    for (f in files) {
        if (files.hasOwnProperty(f)) {
            var collectionName = "";
            var index = ContainsName(fileInfo, files[f].name, "name");
            if (index >= 0) {
                collectionName = fileInfo[index].query.collection;
                fileInfo.splice(index, 1);
            }
            var original = path_module.join(dirs.db, files[f].name);
            var modified = path_module.join(dirs.tmp, files[f].name);
            originalMetadata = JSON.parse(ReadFileMetadata(original, dirs));
            var newMetadata = JSON.parse(ReadFileMetadata(modified, dirs));
            console.log("originalMetadata: " + JSON.stringify(originalMetadata));
            console.log("newMetadata: " + JSON.stringify(newMetadata));
            
            console.log("Checking metadata version strings");
            if (originalMetadata.version === newMetadata.version) {
                console.log("Inferring new version string...");
                var version = newMetadata.version;
                if (version.search(/[\d]+/) >= 0) {
                    var lastNumber = version.replace(/.*?([\d]+)[^\d]*$/g, "$1");
                    console.log("Last number in string: " + lastNumber);
                    var len = lastNumber.length;
                    lastNumber++;
                    for (var j = ("" + lastNumber).length; j < len; j++) {
                        lastNumber = "0" + lastNumber;
                    }
                    console.log("After replacement: " + lastNumber);
                    version = version.replace(/(.*?)([\d]+)([^\d]*)$/g, "$1" + lastNumber + "$3");
                } else {
                    version = version + "2";
                }
                console.log("Changing version from " + originalMetadata.version + " to " + version);
                newMetadata.version = version;
                newMetadata.log = files[f].changelog + newMetadata.changelog;
            }
            WriteFileMetadata(newMetadata, modified, dirs);
            
            console.log("Running store query");
            RunStoreConfigQuery(modified + ".gui.json", newConfig, collectionName, newMetadata.version, newMetadata.configurable_entity, dirs.db);
            console.log("Moving " + modified + " to " + original);
            move(modified + ".gui.json", original + ".gui.json");
        }
    }
    
    console.log("Running addconfig for unmodified files");
    for (f in fileInfo) {
        if (fileInfo.hasOwnProperty(f)) {
            var metadata = ReadFileMetadata(fileInfo[f], dirs);
            RunAddConfigQuery(newConfig, metadata.version, fileInfo[f].query.collection, metadata.configurable_entity, dirs.db);
        }
    }
    
    console.log("Discarding changed configuration");
    return DiscardWorkingDir(files, dirs);
}

/**
 * Creates a new configuration using the provided array of entity information
 * @param {string} configName - The name of the new configuration
 * @param {Object} configData - An object holding the array of data
 * @param {Object[]} configData.entities - The list of entity information, consisting of name, version, and collection
 * @param {Object} dirs - Paths to filesystem directories for temporary storage
 */
function CreateNewConfiguration(configName, configData, dirs) {
    console.log("Creating new configuration");
    var query = {
        operations: []
    };

    for (var d in configData.entities) {
        if (configData.entities.hasOwnProperty(d)) {
            var entityData = configData.entities[d];
            console.log("Entity: " + JSON.stringify(entityData));
            query.operations.push({
                filter: { version: entityData.version, "configurable_entity.name": entityData.name },
                configuration: configName,
                collection: entityData.collection,
                dbprovider: config.dbprovider,
                operation: "addconfig",
                dataformat: "gui"
            });
        }
    }
    
    RunNewConfigQuery(query, dirs.db);
}

/**
 * Reads any configuration-level metadata. Currently limited to a list of entity names and versions present ({}.entities)
 * @param {string} configPath - Name of the configuration
 * @param {Object} dirs - Object containing paths to important directories
 * @param {string} dirs.tmp - The temporary directory for this editing session
 * @param {string} dirs.db - The database temporary storage directory
 * @returns {string} JSON representation of metadata object 
 */
function ReadConfigurationMetadata(configPath, dirs) {
    console.log("Reading metadata for configuration " + configPath);
    
    var data = RunBuildFilterQuery(configPath, dirs.db).search;
    
    var metadata = {
        entities: []
    };
    for (var i in data) {
        if (data.hasOwnProperty(i)) {
            var entityData = RunLoadConfigQuery(data[i].query, data[i].name, dirs.db);
            metadata.entities.push({ name: data[i].query.filter["configurable_entity.name"], file: data[i].name, version: entityData.version, collection: data[i].query.collection });
        }
    }
    
    console.log("Returning entity list: " + JSON.stringify(metadata.entities));
    return JSON.stringify(metadata);
}

/**
 * Reads the metadata objects from the given file
 * @param {string} filebase - Display name of the configuration file to read
 * @param {Object} dirs - Object containing paths to important directories
 * @param {string} dirs.tmp - The temporary directory for this editing session
 * @param {string} dirs.db - The database temporary storage directory
 * @returns {string} JSON representation of metadata object 
 */
function ReadFileMetadata(filebase, dirs) {
    console.log("Reading metadata from " + filebase);
    
    var fileName = path_module.join(dirs.db, filebase + ".gui.json");
    if (fs.existsSync(filebase + ".gui.json")) {
        fileName = filebase + ".gui.json";
    } else if (fs.existsSync(path_module.join(dirs.tmp, filebase + ".gui.json"))) {
        fileName = path_module.join(dirs.tmp, filebase + ".gui.json");
    }
    //console.log("Reading " + fileName);
    
    var jsonFile = JSON.parse("" + fs.readFileSync(fileName));
    var metadata = { configurable_entity: jsonFile.configurable_entity, bookkeeping: jsonFile.bookkeeping, aliases: jsonFile.aliases, configurations: jsonFile.configurations, version: jsonFile.version, changelog: jsonFile.changelog };
    
    //console.log("Returning: " + JSON.stringify(metadata));
    return JSON.stringify(metadata);
}

/**
 * Writes metadata objects to a file (for temporary storage)
 * @param {Object} newMetadata - Metadata object
 * @param {string} filebase - Display name of the configuration file to read
 * @param {Object} dirs - Object containing paths to important directories
 * @param {string} dirs.tmp - The temporary directory for this editing session
 * @param {string} dirs.db - The database temporary storage directory
 */
function WriteFileMetadata(newMetadata, filebase, dirs) {
    
    var fileName = path_module.join(dirs.db, filebase + ".gui.json");
    if (fs.existsSync(filebase + ".gui.json")) {
        fileName = filebase + ".gui.json";
    } else if (fs.existsSync(path_module.join(dirs.tmp, filebase + ".gui.json"))) {
        fileName = path_module.join(dirs.tmp, filebase + ".gui.json");
    }
    
    console.log("Reading file: " + fileName);
    var jsonFile = JSON.parse("" + fs.readFileSync(fileName));
    
    jsonFile.configurable_entity = newMetadata.configurable_entity;
    jsonFile.bookkeeping = newMetadata.bookkeeping;
    jsonFile.aliases = newMetadata.aliases;
    jsonFile.configurations = newMetadata.configurations;
    jsonFile.version = newMetadata.version;
    jsonFile.converted.changelog = newMetadata.changelog;
    
    console.log("Writing data to file");
    //console.log("fileName: " + fileName + ", metadata: " + JSON.stringify(jsonFile));
    fs.writeFileSync(fileName, JSON.stringify(jsonFile));
}

/**
 * Makes the appropriate directories for a given userId
 * @param {string} userId - Unique user identifier
 * @returns {Object} Directories object 
 */
function GetDirectories(userId) {
    // ReSharper disable UseOfImplicitGlobalInFunctionScope
    var db = path_module.join(process.env["HOME"], "databases", "db", userId);
    var tmp = path_module.join(process.env["HOME"], "databases", "tmp", userId);
    var trash = path_module.join(process.env["HOME"], "databases", "TRASH", userId);
    // ReSharper restore UseOfImplicitGlobalInFunctionScope
    
    if (!fs.existsSync(db)) {
        fs.mkdirSync(db);
    }
    if (!fs.existsSync(tmp)) {
        fs.mkdirSync(tmp);
    }
    if (!fs.existsSync(trash)) {
        fs.mkdirSync(trash);
    }
    
    return { db: db, tmp: tmp, trash: trash };
}

// POST calls
db.RO_GetData = function (post) {
    console.log(JSON.stringify(post));
    if (post.configName.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return "";
    }
    return GetData(post.configName, post.path, GetDirectories(post.user));
};

db.RW_MakeNewConfig = function (post) {
    console.log("Request to make new configuration received: " + JSON.stringify(post));
    var dirs = GetDirectories(post.user);
    var configs = RunGetConfigsQuery(dirs.db).search;
    var pathChanged = true;
    if (ContainsName(configs, post.name, "name") >= 0 || !ValidatePath(post.name)) { pathChanged = false; }
    if (pathChanged) {
        console.log("New configuration has a unique name. Good.");
    } else {
        console.log("Inferring new configuration name");
        if (post.name.search(/[\d]+/) >= 0) {
            var lastNumber = post.name.replace(/.*?([\d]+)[^\d]*$/g, "$1");
            console.log("Last number in string: " + lastNumber);
            var len = lastNumber.length;
            lastNumber++;
            for (var j = ("" + lastNumber).length; j < len; j++) {
                lastNumber = "0" + lastNumber;
            }
            console.log("After replacement: " + lastNumber);
            post.name = post.name.replace(/(.*?)([\d]+)([^\d]*)$/g, "$1" + lastNumber + "$3");
        } else {
            post.name = post.name + "_" + Date.now();
        }
    }
    
    console.log("Creating Configuration");
    CreateNewConfiguration(post.name, JSON.parse(post.config), dirs);
    
    return "";
};

db.RW_saveConfig = function (post) {
    console.log("Request to save configuration recieved. Configuration data:");
    console.log(post);
    
    console.log("Checking for Configuration Name or Path changes");
    var pathChanged = post.oldConfigName !== post.newConfigName;
    var configs = RunGetConfigsQuery(GetDirectories(post.user).db).search;
    if (ContainsName(configs, post.newConfigName, "name") >= 0 || !ValidatePath(post.name)) { pathChanged = false; }
    if (pathChanged) {
        console.log("New configuration has a unique name. Good.");
    } else {
        console.log("Inferring new configuration name");
        if (post.newConfigName.search(/[\d]+/) >= 0) {
            var lastNumber = post.newConfigName.replace(/.*?([\d]+)[^\d]*$/g, "$1");
            console.log("Last number in string: " + lastNumber);
            var len = lastNumber.length;
            lastNumber++;
            for (var j = ("" + lastNumber).length; j < len; j++) {
                lastNumber = "0" + lastNumber;
            }
            console.log("After replacement: " + lastNumber);
            post.newConfigName = post.newConfigName.replace(/(.*?)([\d]+)([^\d]*)$/g, "$1" + lastNumber + "$3");
        } else {
            post.newConfigName = post.newConfigName + "_" + Date.now();
        }
    }
    
    console.log("Updating Configuration Files");
    SaveConfigurationChanges(post.oldConfigName, post.newConfigName, post.files, GetDirectories(post.user));
    
    return "";
};

db.RO_LoadNamedConfig = function (post) {
    console.log("Request for configuration with name \"" + post.configName + "\" and search query \"" + post.query + "\" received.");
    
    var structure = GetConfigFiles(post.configName, GetDirectories(post.user), post.query);
    //console.log("Returning DB Structure: " + JSON.stringify(structure));
    return JSON.stringify(structure);
};

db.RO_LoadConfigFile = function (post) {
    console.log("Request for configuration file with name \"" + post.configName + "\" received.");
    return JSON.stringify(ParseFhicl(post.configName + ".gui.json", post.configName, GetDirectories(post.user)));
};

db.RW_discardConfig = function (post) {
    if (post.configName.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return false;
    }
    
    return DiscardWorkingDir(post.files, GetDirectories(post.user));
};

db.RO_Update = function (post) {
    if (post.configName.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return false;
    }
    //console.log(JSON.stringify(post));
    UpdateTable(post.configName, post.table, { id: post.id, name: post.name, column: post.column, value: post.value }, GetDirectories(post.user));
    return "";
};

db.RO_LoadConfigMetadata = function (post) {
    //console.log(JSON.stringify(post));
    if (post.configName.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return false;
    }
    return ReadConfigurationMetadata(post.configName, GetDirectories(post.user));
};

db.RO_LoadFileMetadata = function (post) {
    //console.log(JSON.stringify(post));
    if (post.configName.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return false;
    }
    return ReadFileMetadata(post.fileName, GetDirectories(post.user));
};

// GET calls
db.GET_NamedConfigs = function () {
    var configs = RunGetConfigsQuery(GetDirectories("").db).search;
    //console.log(configs);
    var configsOutput = [];
    for (var conf in configs) {
        if (configs.hasOwnProperty(conf)) {
            var config = configs[conf];
            configsOutput.push("<option value=" + JSON.stringify(config.query) + ">" + config.name + "</option>");
        }
    }
    //console.log(configsOutput);
    return configsOutput;
};

db.GET_EntitiesAndVersions = function () {
    var dbDirectory = GetDirectories("").db;
    var entities = RunGetEntitiesQuery(dbDirectory).search;
    var output = {
        entities: []
    };
    
    for (var ent in entities) {
        if (entities.hasOwnProperty(ent)) {
            var entity = entities[ent];
            var versions = RunGetVersionsQuery(dbDirectory, entity.query);
            var entityObj = {
                name: entity.name,
                versions: versions,
                collection: entity.query.collection
            };
            output.entities.push(entityObj);
        }
    }
    
    return JSON.stringify(output);
};

// Serverbase Module definition
db.MasterInitFunction = function (workerData) {
    var data = {};
    workerData["db"] = data;
    GetDirectories("");
};

module.exports = function (moduleHolder) {
    moduleHolder["db"] = db;
};