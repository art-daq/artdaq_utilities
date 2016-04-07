// db_module.js : Server-side bindings for DB Display module
// Author: Eric Flumerfelt, FNAL RSI
// Last Modified: October 30, 2015
//

// Node.js framework "includes"
// ReSharper disable PossiblyUnassignedProperty
var spawn = require("child_process").spawn;
var Emitter = require("events").EventEmitter;
var fs = require("fs");
var stream = require('stream');
var child_process = require("child_process");
var Utils = require('./Utils');
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
    configNameFilter: "",
    baseDir: path_module.join(process.env["HOME"], "databases")
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
 * @returns {Object} JSON object returned by the database
 * @throws DBOperationFailedException: More information in ex.message
 */
function RunGetConfigsQuery() {
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
    
    var output = conftool.find_global_configurations_ui(JSON.stringify(query));
    //console.log("findconfigs output: " + JSON.stringify(output));
    if (!output.first) {
        throw { name: "DBOperationFailedException", message: output.second };
    }
    // console.log(retjson);
    return JSON.parse(output.second);
};

/**
 * Finds the entities currently present in the database
 * @returns {Object} JSON object returned by the database 
 * @throws DBOperationFailedException: More information in ex.message
 */
function RunGetEntitiesQuery() {
    console.log("Running findentities query");
    var query = {
        filter: {},
        dbprovider: config.dbprovider,
        operation: "findentities",
        dataformat: "gui"
    };
    
    var output = conftool.find_configuration_entities_ui(JSON.stringify(query));
   // console.log("Findentities output: " + JSON.stringify(output));
    if (!output.first) {
        throw { name: "DBOperationFailedException", message: output.second };
    }
    return JSON.parse(output.second);
};

/**
 * Runs the findversions query using the given entity query
 * @param {Object} query - The query to run (as returned by buildfilter)
 * @returns {Object} JSON object returned by the database
 * @throws DBOperationFailedException: More information in ex.message
 */
function RunGetVersionsQuery(query) {
    console.log("Running findversions query");
    
    var output = conftool.find_configuration_versions_ui(JSON.stringify(query));
    //console.log("findversions output: " + JSON.stringify(output));
    if (!output.first) {
        throw { name: "DBOperationFailedException", message: output.second };
    }
    return JSON.parse(output.second);
};

/**
 * Runs a buildfilter operation against the database
 * @param {string} configName - Name of the configuration
 * @param {Object} queryIn - Optional query object
 * @returns {Object} JSON object returned by the database
 * @throws DBOperationFailedException: More information in ex.message
 */
function RunBuildFilterQuery(configName, queryIn) {
    var query = {};
    
    if (queryIn === undefined) {
        console.log("Getting query for " + configName);
        var configs = RunGetConfigsQuery().search;
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
    
    console.log("Running buildfilter query: " + JSON.stringify(query));
    var output = conftool.build_global_configuration_search_filter_ui(JSON.stringify(query));
    
    //console.log("buildfilter output: " + JSON.stringify(output));
    if (!output.first) {
        throw { name: "DBOperationFailedException", message: output.second };
    }
    return JSON.parse(output.second);
};

/**
 * Creates a new configuration containing the given file versions
 * @returns {Object} JSON object returned by the database
 * @param {Object} query - Query to run
 * @throws DBOperationFailedException: More information in ex.message
 */
function RunNewConfigQuery(query) {
    console.log("Running newconfig query: " + JSON.stringify(query));
    
    var output = conftool.create_new_global_configuration_ui(JSON.stringify(query));
    console.log("newconfig output: " + JSON.stringify(query));
    
    console.log("RunNewConfigQuery return status " + output.first);
    if (!output.first) {
        throw { name: "DBOperationFailedException", message: output.second };
    }
};

/**
 * Adds a configuration file to a configuration
 * @param {string} configName - Name of the configuration to modify
 * @param {string} version - Version of the new config file
 * @param {string} collectionName - Collection of new config file
 * @param {Object} entity - Entity information of new config file
 * @param {string} entity.name - Name of the configurable entity
 * @throws DBOperationFailedException: More information in ex.message
 */
function RunAddConfigQuery(configName, version, collectionName, entity) {
    console.log("RunAddConfigQuery: configName: " + configName + ", version: " + version + ", collectionName: " + collectionName + ", entity: " + JSON.stringify(entity));
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
    
    var output = conftool.add_configuration_to_global_configuration_ui(JSON.stringify(query));
    //console.log("addconfig output: " + JSON.stringify(output));
    
    console.log("RunAddConfigQuery return status " + output.first);
    if (!output.first) {
        throw { name: "DBOperationFailedException", message: output.second };
    }
};

/**
 * Runs a store query against the database
 * @param {string} data - File to store
 * @param {string} collectionName - Name of the collection
 * @param {string} version - Version identifier
 * @param {string} entity.name - Configurable Entity name
 * @param {string} type - Type of data ("gui", "fhicl", etc.)
 * @param {string} configName - Name of the configuration to store data in (Optional)
 * @throws DBOperationFailedException: More information in ex.message
 */
function RunStoreQuery(data, collectionName, version, entity, type, configName) {
    
    console.log("RunStoreConfigQuery: configName: " + configName + ", collectionName: " + collectionName + ", version: " + version + ", entity: " + JSON.stringify(entity) + ", dataType: " + type);
    var query = {
        version: version,
        collection: collectionName,
        configurable_entity: entity.name,
        dbprovider: config.dbprovider,
        operation: "store",
        dataformat: type
    };
    if (configName !== undefined) {
        query.configuration = configName;
    }
    
    console.log("RunStoreQuery: Query: " + JSON.stringify(query) + ", Data: " + data);
    var output = conftool.store_configuration_ui(JSON.stringify(query), data);
    
    console.log("RunStoreConfigQuery return status " + output.first);
    if (!output.first) {
        throw { name: "DBOperationFailedException", message: output.second };
    }
};

/**
 * Loads a configuration file from the database
 * @param {Object} query - The query to run (as returned by buildfilter)
 * @returns {Object} Object from database
 * @throws DBOperationFailedException: More information in ex.message
 */
function RunLoadQuery(query) {
    console.log("Running load query");
    
    var output = conftool.load_configuration_ui(JSON.stringify(query));
    console.log("Conftool Load output: " + output.first);
    if (!output.first) {
        throw { name: "DBOperationFailedException", message: output.second };
    }
    
    return JSON.parse(output.second);
};


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
};

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
};

/**
 * Reads a .gui.json file and performs conversion for sending to the client
 * @param {string} fileName - Name of the file to load
 * @param {string} name - Display name of this configuration object
 * @param {Object} dirs - Object containing paths to important directories
 * @param {string} dirs.tmp - The temporary directory for this editing session
 * @param {string} dirs.db - The database temporary storage directory
 * @returns {Object} Converted FHiCL data
 * @throws FileNotFoundException - The requested file was not found
 */
function ParseFhicl(fileName, name, dirs) {
    var filePath = path_module.join(dirs.db, fileName);
    if (fs.existsSync(path_module.join(dirs.tmp, fileName))) {
        filePath = path_module.join(dirs.tmp, fileName);
    }
    if (!fs.existsSync(filePath)) { throw { name: "FileNotFoundException", message: "The requested file was not found" }; }
    console.log("Going to load FhiCL file: " + filePath);
    var fcl = JSON.parse("" + fs.readFileSync(filePath));
    
    //console.log(JSON.stringify(fcl));
    return ParseFhiclTable({ children: fcl.document.converted.guidata, name: name }, 0);
};

/**
 * Returns the list of files present in a configuration, after loading them to temporary storage
 * @param {string} configName - Name of the configuration to load
 * @param {string} dbDirectory - The database temporary storage directory
 * @param {Object} query - Database query for buildFilter
 * @returns {Object} {}.files contains the names of the files, .Success is whether the operation succeeded.
 */
function LoadConfigFiles(configName, dbDirectory, query) {
    var retval = {
        files: [],
        Success: false
    };
    var error = false;
    var configFiles = [];
    var e;
    try {
        configFiles = RunBuildFilterQuery(configName, query).search;
    } catch (e) {
        error = true;
        console.log("Exception occurred: " + e.name + ": " + e.message);
    }
    if (!error) {
        try {
            for (var file in configFiles) {
                if (configFiles.hasOwnProperty(file)) {
                    console.log("File info: " + JSON.stringify(configFiles[file]));
                    var filebase = configFiles[file].name + "_" + configFiles[file].query.collection;
                    retval.files.push(filebase);
                    var data = RunLoadQuery(configFiles[file].query);
                    var filePath = path_module.join(dbDirectory, filebase + ".gui.json");
                    fs.writeFileSync(filePath, JSON.stringify(data));
                }
            }
            retval.Success = true;
        } catch (e) {
            console.log("Exception occurred: " + e.name + ": " + e.message);
        }
    }
    return retval;
};

/**
 * Returns a table from a configuration
 * @param {string} configPath - Name of the configuration
 * @param {string} tablePath - Path to the table, unix style (Config File Name/path/to/table)
 * @param {Object} dirs - Object containing paths to important directories
 * @param {string} dirs.tmp - The temporary directory for this editing session
 * @param {string} dirs.db - The database temporary storage directory
 * @returns {Object} Table Object
 * @throws FileNotFoundException - The requested file was not found
 * @throws TableNotFoundException - The named table was not found
 */
function GetData(configPath, tablePath, dirs) {
    console.log("Searching for Table " + tablePath + " from configuration " + configPath);
    var path = tablePath.split("/");
    var filebase = path.shift();
    var fileName = path_module.join(dirs.db, filebase + ".gui.json");
    if (fs.existsSync(path_module.join(dirs.tmp, filebase + ".gui.json"))) {
        fileName = path_module.join(dirs.tmp, filebase + ".gui.json");
    }
    if (!fs.existsSync(fileName)) { throw { name: "FileNotFoundException", message: "The requested file was not found" }; }
    var jsonFile = JSON.parse("" + fs.readFileSync(fileName));
    var jsonBase = ParseFhiclTable({ children: jsonFile.document.converted.guidata, name: filebase }, 0);
    
    while (path.length > 1) {
        var index = Utils.ContainsName(jsonBase.children, path[0], "name");
        //console.log("index is " + index);
        jsonBase = jsonBase.children[index];
        path.shift();
    }
    
    var table = Utils.ContainsName(jsonBase.children, path[0], "name");
    //console.log("Index of table with name " + path[0] + " is " + table);
    if (table >= 0) {
        var obj = {};
        obj.data = jsonBase.children[table];
        obj.columns = defaultColumns.columns;
        obj.comment = defaultColumns.comment;
        return obj;

    }
    
    throw { name: "TableNotFoundException", message: "The named table was not found" };
};

/**
 * Saves a change from UpdateTable to a temporary file on disk.
 * @param {string} configPath - Name of the Configuration
 * @param {string} tablePath - Path to the table, unix style (Config File Name/path/to/table)
 * @param {string} table - Modified table data
 * @param {Object} dirs - Object containing paths to important directories
 * @param {string} dirs.tmp - The temporary directory for this editing session
 * @param {string} dirs.db - The database temporary storage directory
 * @throws FileNotFoundException - The requested file was not found
 */
function SetTable(configPath, tablePath, table, dirs) {
    console.log("SetTable: Searching for Table " + tablePath);
    var path = tablePath.split("/");
    var filebase = path.shift(); // Get rid of filename for now
    
    var fileName = path_module.join(dirs.db, filebase + ".gui.json");
    if (fs.existsSync(path_module.join(dirs.tmp, filebase + ".gui.json"))) {
        fileName = path_module.join(dirs.tmp, filebase + ".gui.json");
    }
    if (!fs.existsSync(fileName)) { throw { name: "FileNotFoundException", message: "The requested file was not found" }; }
    var jsonFile = JSON.parse("" + fs.readFileSync(fileName));
    var fileTable = jsonFile.document.converted.guidata;
    var refs = [];
    var index;
    if (path.length > 0 && path[0] !== "Table Entries") {
        //console.log("fileTable is " + JSON.stringify(fileTable));
        index = Utils.ContainsName(fileTable, path[0], "name");
        refs.push({ ref: fileTable, index: index, first: true });
        fileTable = fileTable[index];
        path.shift();
    }
    
    while (path.length > 0 && path[0] !== "Table Entries") {
        //console.log("fileTable is " + JSON.stringify(fileTable));
        index = Utils.ContainsName(fileTable.children, path[0], "name");
        refs.push({ ref: fileTable, index: index, first: false });
        fileTable = fileTable.children[index];
        path.shift();
    }
    if (path[0] === "Table Entries") {
        for (var entry in table.children) {
            if (table.children.hasOwnProperty(entry)) {
                index = Utils.ContainsName(fileTable.children, table.children[entry].name, "name");
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
};

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
    var oldData = file.data;
    
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
};

/**
 * Removes a user's temporary directory, not saving changes to the database
 * @param {Object} dirs - Object containing paths to important directories
 * @param {string} dirs.tmp - The temporary directory for this editing session
 * @param {string} dirs.db - The database temporary storage directory
 * @param {string} dirs.trash - The directory to hold discarded configuration changes
 */
function DiscardWorkingDir(dirs) {
    console.log("Deleting existing trash dir (if any)");
    Utils.ExecSync("rm -rf " + dirs.trash);
    console.log("DiscardWorkingDir: Moving db temp to TRASH: mv " + dirs.db + " " + dirs.trash);
    Utils.ExecSync("mv " + dirs.db + " " + dirs.trash);
    console.log("DiscardWorkingDir: Moving temp files to TRASH: mv " + dirs.tmp + "/* " + dirs.trash);
    Utils.ExecSync("mv " + dirs.tmp + "/* " + dirs.trash);
    console.log("DiscardWorkingDir: Deleting temp directory: rmdir " + dirs.tmp);
    Utils.ExecSync("rmdir " + dirs.tmp);
};

/**
 * Creates a new configuration containing all modifications to the old configuration plus any unmodified files.
 * @param {string} oldConfig - Name of the old configuration
 * @param {string} newConfig - Name of the new configuration
 * @param {string[]} files - List of modified files
 * @param {Object} dirs - Object containing paths to important directories
 * @param {string} dirs.tmp - The temporary directory for this editing session
 * @param {string} dirs.db - The database temporary storage directory
 * @param {string} dirs.trash - The directory to hold discarded configuration changes
 * @throws DBOperationFailedException: More information in ex.message
 * @throws CollectionNameNotFound - Unable to determine collection name
 */
function SaveConfigurationChanges(oldConfig, newConfig, files, dirs) {
    console.log("Saving Configuration Changes, oldConfig: " + oldConfig + ", newConfig: " + newConfig + ", files: " + JSON.stringify(files));
    var fileInfo = RunBuildFilterQuery(oldConfig).search;
    
    var originalMetadata;
    var f;
    for (f in files) {
        if (files.hasOwnProperty(f)) {
            var collectionName = files[f].collection;
            var query = {};
            for (var fi in fileInfo) {
                if (fileInfo.hasOwnProperty(fi)) {
                    if (files[f].name === fileInfo[fi].name + "_" + fileInfo[fi].query.collection) {
                        query = fileInfo[fi].query;
                        collectionName = fileInfo[fi].query.collection;
                        fileInfo.splice(fi, 1);
                    }
                }
            }
            if (collectionName === "") {
                throw { name: "CollectionNameNotFoundException", message: "Unable to determine collection for file " + files[f].name };
            }
            console.log("Getting metadata from original and changed files");
            var original = path_module.join(dirs.db, files[f].name);
            var modified = path_module.join(dirs.tmp, files[f].name);
            originalMetadata = ReadFileMetadata(original, dirs, query);
            var newMetadata = ReadFileMetadata(modified, dirs, query);
            console.log("originalMetadata: " + JSON.stringify(originalMetadata));
            console.log("newMetadata: " + JSON.stringify(newMetadata));
            
            console.log("Checking metadata version strings");
            while (originalMetadata.version === newMetadata.version || VersionExists(newMetadata.configurable_entity, collectionName, newMetadata.version, dirs.db)) {
                console.log("Inferring new version string...");
                var version = Utils.Uniquify(newMetadata.version);
                console.log("Changing version from " + originalMetadata.version + " to " + version);
                newMetadata.version = version;
                console.log("OK");
            }
            console.log("Prepending changelog");
            newMetadata.changelog = files[f].changelog + newMetadata.changelog;
            
            console.log("Writing new metadata to file");
            WriteFileMetadata(newMetadata, modified, dirs);
            
            console.log("Running store query");
            var data = "" + fs.readFileSync(modified + ".gui.json");
            console.log("Writing " + data + " to database");
            RunStoreQuery(data, collectionName, newMetadata.version, newMetadata.configurable_entity,"gui", newConfig);
        }
    }
    
    console.log("Running addconfig for unmodified files: " + JSON.stringify(fileInfo));
    for (f in fileInfo) {
        if (fileInfo.hasOwnProperty(f)) {
            var unmodifiedVersion = GetVersion(fileInfo[f].query.filter["configurable_entity.name"], fileInfo[f].query.collection, oldConfig);
            RunAddConfigQuery(newConfig, unmodifiedVersion, fileInfo[f].query.collection, { name: fileInfo[f].query.filter["configurable_entity.name"] });
        }
    }
    
    DiscardWorkingDir(dirs);
};

/**
 * Creates a new configuration using the provided array of entity information
 * @param {string} configName - The name of the new configuration
 * @param {Object} configData - An object holding the array of data
 * @param {Object[]} configData.entities - The list of entity information, consisting of name, version, and collection
 * @param {Object} dirs - Paths to filesystem directories for temporary storage
 * @throws DBOperationFailedException: More information in ex.message
 */
function CreateNewConfiguration(configName, configData) {
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
    
    RunNewConfigQuery(query);
};

/**
 * Reads any configuration-level metadata. Currently limited to a list of entity names and versions present ({}.entities)
 * @param {string} configPath - Name of the configuration
 * @returns {Object} Configuration metadata object
 * @throws DBOperationFailedException: More information in ex.message
 */
function ReadConfigurationMetadata(configPath) {
    console.log("Reading metadata for configuration " + configPath);
    
    var data = RunBuildFilterQuery(configPath).search;
    
    var metadata = {
        entities: []
    };
    for (var i in data) {
        if (data.hasOwnProperty(i)) {
            var version = GetVersion(data[i].query.filter["configurable_entity.name"], data[i].query.collection, configPath);
            metadata.entities.push({ name: data[i].query.filter["configurable_entity.name"], file: data[i].name + "_" + data[i].query.collection, version: version, collection: data[i].query.collection });
        }
    }
    
    console.log("Returning entity list: " + JSON.stringify(metadata.entities));
    return metadata;
};

/**
 * Gets the version of a given entity/collection in configName
 * @param {string} entityName - Name of the configurable entity
 * @param {string} collection - Name of the collection
 * @param {string} configName - Name of the configuration
 * @returns {string} Version identifier
 * @throws DBOperationFailedException: More information in ex.message
 */
function GetVersion(entityName, collection, configName) {
    var filts = RunBuildFilterQuery(configName).search;
    for (var f in filts) {
        if (filts.hasOwnProperty(f)) {
            if (filts[f].query.filter["configurable_entity.name"] === entityName && filts[f].query.collection === collection) {
                var ver = RunLoadQuery(filts[f].query).version;
                console.log("GetVersion Returning " + ver);
                return ver;
            }
        }
    }
    throw {name:"DBOperationFailedException", message:"Failed to find the entity/collection ("+entityName+"/"+collection+") in the database"}
    //// This doesn't work yet...
    //var query = {
    //    collection: collection,
    //    dbprovider: config.dbprovider,
    //    dataformat: "gui",
    //    operation: "findversions",
    //    filter: {
    //        "configurable_entity.name": entityName,
    //        "configuration": configName
    //    }
    //}
    //var vers = RunGetVersionsQuery(query).search;
    //return vers[0].name;
};

/**
 * Reads the metadata objects from the given file
 * @param {string} filebase - Display name of the configuration file to read
 * @param {Object} dirs - Object containing paths to important directories
 * @param {string} dirs.tmp - The temporary directory for this editing session
 * @param {string} dirs.db - The database temporary storage directory
 * @param {Object} query - Database query for file
 * @returns {Object} The metadata object 
 * @throws DBOperationFailedException: More information in ex.message
 */
function ReadFileMetadata(filebase, dirs, query) {
    console.log("Reading metadata from " + filebase);
    
    var fileName = path_module.join(dirs.db, filebase + ".gui.json");
    if (fs.existsSync(filebase + ".gui.json")) {
        fileName = filebase + ".gui.json";
    } else if (fs.existsSync(path_module.join(dirs.tmp, filebase + ".gui.json"))) {
        fileName = path_module.join(dirs.tmp, filebase + ".gui.json");
    }
    
    var jsonFile;
    if (!fs.exists(fileName)) {
        jsonFile = RunLoadQuery(query);
    } else {
        console.log("Reading " + fileName);
        jsonFile = JSON.parse("" + fs.readFileSync(fileName));
    }
    
    if (jsonFile.changelog === undefined) {
        jsonFile.changelog = "";
    }
    var metadata = {
        configurable_entity: jsonFile.configurable_entity,
        bookkeeping: jsonFile.bookkeeping, 
        aliases: jsonFile.aliases,
        configurations: jsonFile.configurations,
        version: jsonFile.version,
        changelog: jsonFile.changelog,
        collection: query.collection
    };
    
    console.log("ReadFileMetadata returning: " + JSON.stringify(metadata));
    return metadata;
};

/**
 * Writes metadata objects to a file (for temporary storage)
 * @param {Object} newMetadata - Metadata object
 * @param {string} filebase - Display name of the configuration file to read
 * @param {Object} dirs - Object containing paths to important directories
 * @param {string} dirs.tmp - The temporary directory for this editing session
 * @param {string} dirs.db - The database temporary storage directory
 * @throws FileNotFoundException - The requested file was not found
 */
function WriteFileMetadata(newMetadata, filebase, dirs) {
    
    var fileName = path_module.join(dirs.db, filebase + ".gui.json");
    if (fs.existsSync(filebase + ".gui.json")) {
        fileName = filebase + ".gui.json";
    } else if (fs.existsSync(path_module.join(dirs.tmp, filebase + ".gui.json"))) {
        fileName = path_module.join(dirs.tmp, filebase + ".gui.json");
    }
    
    console.log("Reading file: " + fileName);
    if (!fs.existsSync(fileName)) { throw { name: "FileNotFoundException", message: "The requested file was not found" }; }
    var jsonFile = JSON.parse("" + fs.readFileSync(fileName));
    
    
    console.log("Setting fields: " + JSON.stringify(newMetadata));
    jsonFile.configurable_entity = newMetadata.configurable_entity;
    jsonFile.bookkeeping = newMetadata.bookkeeping;
    jsonFile.aliases = newMetadata.aliases;
    jsonFile.configurations = newMetadata.configurations;
    jsonFile.version = newMetadata.version;
    // jsonFile.changelog = newMetadata.changelog;
    
    console.log("Writing data to file");
    //console.log("fileName: " + fileName + ", metadata: " + JSON.stringify(jsonFile));
    fs.writeFileSync(fileName, JSON.stringify(jsonFile));
};

/**
 * Makes the appropriate directories for a given userId
 * @param {string} userId - Unique user identifier
 * @returns {Object} Directories object 
 */
function GetDirectories(userId) {
    // ReSharper disable UseOfImplicitGlobalInFunctionScope
    var db = path_module.join(config.baseDir, "db", userId);
    var tmp = path_module.join(config.baseDir, "tmp", userId);
    var trash = path_module.join(config.baseDir, "TRASH", userId);
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
};

/**
 * Reads a file out of the database and returns information on where to find it
 * @param {Object} fileInfo - Input search criteria
 * @param {string} fileInfo.name - Configurable Entity Name
 * @param {string} fileInfo.collection - Collection Name
 * @param {string} fileInfo.version - Configuration Version
 * @param {string} dbdirectory - Database storage directory
 * @returns {Object} Information abouit the output: fileName, filePath, and size
 * @throws DBOperationFailedException: More information in ex.message
 */
function FetchFhiclFile(fileInfo, dbdirectory) {
    var fileName = fileInfo.name + "_" + fileInfo.collection + "_" + fileInfo.version + ".fcl";
    var filePath = path_module.join(dbdirectory, fileName);
    
    var query = {
        filter: {
            "configurable_entity.name": fileInfo.name,
            version: fileInfo.version
        },
        collection: fileInfo.collection,
        dbprovider: config.dbprovider,
        operation: "load",
        dataformat: "fhicl"
    };
    var fhiclData = RunLoadQuery(query);
    fs.writeFileSync(filePath, fhiclData);
    
    var stat = fs.statSync(filePath);
    return { fileName: fileName, filePath: filePath, size: stat.size }
};

/**
 * Check if a given version exists for a given entity/collection
 * @param {string} entity.name - Name of the Configurable Entity
 * @param {string} collection - Collection name
 * @param {string} version - Version identifier
 * @returns {Boolean} Whether the version already exists 
 * @throws DBOperationFailedException: More information in ex.message
 */
function VersionExists(entity, collection, version) {
    console.log("Checking if version " + version + " exists for entity " + JSON.stringify(entity) + " in collection " + collection);
    var query = {
        filter: {
            "configurable_entity.name": entity
        },
        collection: collection,
        dbprovider: config.dbprovider,
        operation: "findversions",
        dataformat: "gui"
    };
    var vers = RunGetVersionsQuery(query).search;
    return Utils.ContainsName(vers, version, "name") >= 0;
};

// POST calls
db.RO_GetData = function (post) {
    console.log(JSON.stringify(post));
    var ret = { Success: false, data: {} };
    try {
        ret.data = GetData(post.configName, post.path, GetDirectories(post.user));
        ret.Success = true;
    } catch (e) {
        console.log("Exception occurred: " + e.name + ": " + e.message);
    }
    
    return ret;
};

db.RW_MakeNewConfig = function (post) {
    console.log("Request to make new configuration received: " + JSON.stringify(post));
    var res = { Success: false };
    var error = false;
    var e;
    try {
        var configs = RunGetConfigsQuery().search;
        if (!Utils.ValidatePath(post.name)) {
            console.log("Invalid name detected!");
            error = true;
        }
        while (Utils.ContainsName(configs, post.name, "name") >= 0) {
            console.log("Inferring new configuration name");
            post.name = Utils.Uniquify(post.name);
        }
    } catch (e) {
        error = true;
        console.log("Exception occurred: " + e.name + ": " + e.message);
    }
    if (!error) {
        console.log("Creating Configuration");
        try {
            CreateNewConfiguration(post.name, JSON.parse(post.config));
            res.Success = true;
        } catch (e) {
            console.log("Exception occurred: " + e.name + ": " + e.message);
        }
    }
    return res;
};

db.RW_saveConfig = function (post) {
    console.log("Request to save configuration recieved. Configuration data: " + JSON.stringify(post));
    var res = { Success: false };
    var error = false;
    var e;
    try {
        console.log("Checking for unique Configuration name");
        var configs = RunGetConfigsQuery().search;
        if (!Utils.ValidatePath(post.newConfigName) || Utils.ContainsName(configs, post.oldConfigName, "name") < 0) {
            console.log("Invalid name detected!");
            error = true;
        }
        while (Utils.ContainsName(configs, post.newConfigName, "name") >= 0) {
            console.log("Inferring new configuration name");
            post.newConfigName = Utils.Uniquify(post.newConfigName);
        }
    } catch (e) {
        error = true;
        console.log("Exception occurred: " + e.name + ": " + e.message);
    }
    if (!error) {
        try {
            console.log("Updating Configuration Files");
            SaveConfigurationChanges(post.oldConfigName, post.newConfigName, post.files, GetDirectories(post.user));
            res.Success = true;
        } catch (e) {
            console.log("Exception occurred: " + e.name + ": " + e.message);
        }
    }
    return res;
};

db.RO_LoadNamedConfig = function (post) {
    console.log("Request for configuration with name \"" + post.configName + "\" and search query \"" + post.query + "\" received.");
    return LoadConfigFiles(post.configName, GetDirectories(post.user).db, JSON.parse(post.query));
};

db.RO_LoadConfigFile = function (post) {
    console.log("Request for configuration file with name \"" + post.configName + "\" received.");
    var ret = { Success: false, data: {} };
    try {
        ret.data = ParseFhicl(post.configName + ".gui.json", post.configName, GetDirectories(post.user));
        ret.Success = true;
    } catch (e) {
        console.log("Exception caught: " + e.name + ": " + e.message);
    }
    return ret;
};

db.RW_discardConfig = function (post) {
    //console.log(JSON.stringify(post));
    DiscardWorkingDir(GetDirectories(post.user));
    return { Success: true };
};

db.RO_Update = function (post) {
    //console.log(JSON.stringify(post));
    UpdateTable(post.configName, post.table, { id: post.id, name: post.name, column: post.column, value: post.value }, GetDirectories(post.user));
    return { Success: true };
};

db.RO_LoadConfigMetadata = function (post) {
    //console.log(JSON.stringify(post));
    var ret = { Success: false, data: {} };
    try {
        ret.data = ReadConfigurationMetadata(post.configName, GetDirectories(post.user));
        ret.Success = true;
    } catch (e) {
        console.log("Exception caught: " + e.name + ": " + e.message);
    }
    return ret;
};

db.RO_LoadFileMetadata = function (post) {
    //console.log(JSON.stringify(post));
    var ret = { Success: false, data: {} };
    var dirs = GetDirectories(post.user);
    var error = false;
    var query = {};
    var e;
    try {
        var search = RunBuildFilterQuery(post.configName).search;
        for (var s in search) {
            if (search.hasOwnProperty(s)) {
                if (search[s].name + "_" + search[s].query.collection === post.fileName) {
                    query = search[s].query;
                }
            }
        }
    } catch (e) {
        error = true;
        console.log("Exception caught: " + e.name + ": " + e.message);
    }
    if (!error) {
        try {
            ret.data = ReadFileMetadata(post.fileName, dirs, query);
            ret.Success = true;
        } catch (e) {
            console.log("Exception caught: " + e.name + ": " + e.message);
        }
    }
    
    return ret;
};

db.RW_UploadConfigurationFile = function (post) {
    console.log("Recieved request to upload file: " + JSON.stringify(post));
    var e;
    var error = false;
    var ret = { Success: false };
    try {
        while (VersionExists(post.entity, post.collection, post.version)) {
            console.log("Version already exists. Running uniquifier...");
            post.version = Utils.Uniquify(post.version);
        }
    } catch (e) {
        error = true;
        console.log("Exception caught: " + e.name + ": " + e.message);
    }
    
    if (!error) {
        console.log("Running store fhicl query");
        try {
            RunStoreQuery(post.fhicl, post.collection, post.version, { name: post.entity }, "fhicl");
            ret.Success = true;
        } catch (e) {
            console.log("Exception caught: " + e.name + ": " + e.message);
        }
    }
    return ret;
};

db.RO_DownloadConfigurationFile = function (post) {
    console.log("Request to download file(s) received: " + JSON.stringify(post));
    var dirs = GetDirectories(post.user);
    var configObj = JSON.parse(post.config);
    try {
        if (configObj.entities.length === 1) {
            var fileInfo = FetchFhiclFile(configObj.entities[0], dirs.db);
            
            var fclhdrs = {
                'Content-Type': 'text/plain',
                'Content-Length': fileInfo.size,
                'Content-Disposition': 'attachment filename=' + fileInfo.fileName
            }
            
            var fclStream = fs.createReadStream(fileInfo.filePath);
            db.emit("stream", fclStream, fclhdrs, 200);
        } else if (configObj.entities.length > 1) {
            var args = ['cz'];
            for (var e in configObj.entities) {
                if (configObj.entities.hasOwnProperty(e)) {
                    args.push(FetchFhiclFile(configObj.entities[e], dirs.db).fileName);
                }
            }
            
            var tarhdrs = {
                'Content-Type': 'application/x-gzip',
                'Content-Disposition': 'attachment filename=export.tar.gz'
            }
            
            console.log("Spawning: tar " + args.join(" "));
            var tar = child_process.spawn("tar", args, { cwd: dirs.db, stdio: [0, 'pipe', 0] });
            db.emit("stream", tar.stdout, tarhdrs, 200);

        }
    } catch (err) {
        console.log("Exception caught: " + err.name + ": " + err.message);
        
        var s = new stream.Readable();
        s._read = function noop() { };
        s.push("ERROR");
        s.push(null);
        db.emit("stream", s, 500);
    }
    //Stream emit has its own 'end', no return value necessary
};

// GET calls
db.GET_NamedConfigs = function () {
    console.log("Request for Named Configurations received");
    var configsOutput = { Success: false, data: [] };
    try {
        var configs = RunGetConfigsQuery().search;
        for (var conf in configs) {
            if (configs.hasOwnProperty(conf)) {
                var config = configs[conf];
                configsOutput.data.push("<option value=" + JSON.stringify(config.query) + ">" + config.name + "</option>");
            }
        }
        configsOutput.Success = true;
    } catch (e) {
        console.log("Exception caught: " + e.name + ": " + e.message);
    }
    return configsOutput;
};

db.GET_EntitiesAndVersions = function () {
    var output = {
        Success: false,
        collections: []
    };
    try {
        var entities = RunGetEntitiesQuery().search;
        for (var ent in entities) {
            if (entities.hasOwnProperty(ent)) {
                var entity = entities[ent];
                var versions = RunGetVersionsQuery(entity.query);
                if (Utils.ContainsName(output.collections, entity.query.collection, "name") < 0) {
                    output.collections.push({ name: entity.query.collection, entities: [] });
                }
                
                var index = Utils.ContainsName(output.collections, entity.query.collection, "name");
                
                var entityObj = {
                    collection: entity.query.collection,
                    name: entity.name,
                    versions: versions
                };
                output.collections[index].entities.push(entityObj);
            }
        }
        output.Success = true;
    } catch (e) {
        console.log("Exception caught: " + e.name + ": " + e.message);
    }
    return output;
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