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
// ReSharper restore PossiblyUnassignedProperty
var db = new Emitter();

var dbDirectory = path_module.join(process.env["HOME"], "databases", "db");
var tmpDirectory = path_module.join(process.env["HOME"], "databases", "tmp");
var trashDirectory = path_module.join(process.env["HOME"], "databases", "TRASH");

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

function ContainsString(arr, val) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i].search(val) >= 0) {
            return i;
        }
    }
    return -1;
}

function ContainsName(arr, val, name) {
    for (var i = 0; i < arr.length; i++) {
        //console.log("Checking if " + arr[i][name] + " is equal to " + val);
        if (arr[i][name] === val) {
            return i;
        }
    }
    return -1;
}

function GetNamedConfigs() {
    
    console.log("Searching for Named Configs in path " + dbDirectory);
    // we have a directory: do a tree walk
    var configs = [];
    var files = fs.readdirSync(dbDirectory);
    var f, l = files.length;
    for (var i = 0; i < l; i++) {
        f = path_module.join(dbDirectory, files[i]);
        if (files[i].search(".gui.json") > 0) {
            DiscardWorkingDir(path_module.basename(f));
            configs.push(files[i]);
        }
    }
    console.log(JSON.stringify(configs));
    return configs;
}

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

function ParseFhiclTable(table, sub) {
    var children = [];
    var atoms = [];
    var hasSubtables = false;
    var comment = table.comment ? table.comment : "";
    //console.log("Table name is " + name);
    
    for (var e in table.children) {
        if (table.children.hasOwnProperty(e)) {
            var element = table.children[e];
            console.log("Element: " + JSON.stringify(element));
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
    }
    else if (atoms.length > 0) {
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
    
    var obj = { name: table.name, hasSubtables: hasSubtables, children: children,type: "table", comment: comment };
    if (sub === 0) { console.log("Returning: " + JSON.stringify(obj)); }
    return obj;
}

function ParseFhicl(path, name) {
    var fileName = path_module.join(dbDirectory, path);
    if (fs.existsSync(path_module.join(tmpDirectory, path))) { fileName = path_module.join(tmpDirectory, path); }
    console.log("Going to load FhiCL file: " + fileName);
    var fcl = JSON.parse("" + fs.readFileSync(fileName));
    console.log(JSON.stringify(fcl));
    return ParseFhiclTable({ children: fcl.document.converted.guidata, name: name }, 0);
}

function GetDBStructure(configPath) {
    var configs = GetNamedConfigs();
    if (configs.length === 0) { return false; }
    var index = ContainsString(configs, configPath);
    if (index < 0) {
        return false;
    }
    
    return ParseFhicl(configPath);
}

function GetData(configPath, tablePath) {
    console.log("Searching for Table " + tablePath + " in " + configPath);
    var path = tablePath.split("/");
    
    var fileName = path_module.join(dbDirectory, configPath);
    if (fs.existsSync(path_module.join(tmpDirectory, configPath))) { fileName = path_module.join(tmpDirectory, configPath); }
    var jsonFile = JSON.parse("" + fs.readFileSync(fileName));
    var jsonBase = ParseFhiclTable({ children: jsonFile.document.converted.guidata, name: configPath }, 0);
    
    while (path.length > 1) {
        var index = ContainsName(jsonBase.children, path[0], "name");
        console.log("index is " + index);
        jsonBase = jsonBase.children[index];
        path.shift();
    }
    
    var table = ContainsName(jsonBase.children, path[0], "name");
    console.log("Index of table with name " + path[0] + " is " + table);
    if (table >= 0) {
        var obj = {};
        obj.data = jsonBase.children[table];
        obj.columns = defaultColumns.columns;
        obj.comment = defaultColumns.comment;
        var str = JSON.stringify(obj);
        console.log("Returning: " + str);
        return str;
        
    }
    
    return "{}";
}

function SetTable(configPath, tablePath, table) {
    console.log("SetTable: Searching for Table " + tablePath + " in " + configPath);
    var path = tablePath.split("/");
    
    var fileName = path_module.join(dbDirectory, configPath);
    if (fs.existsSync(path_module.join(tmpDirectory, configPath))) { fileName = path_module.join(tmpDirectory, configPath); }
    var jsonFile = JSON.parse("" + fs.readFileSync(fileName));
    var fileTable = jsonFile.document.converted.guidata;
    var refs = [];
    var index;
    if (path.length > 0 && path[0] !== "Table Entries") {
        console.log("fileTable is " + JSON.stringify(fileTable));
        index = ContainsName(fileTable, path[0], "name");
        refs.push({ ref: fileTable, index: index, first: true });
        fileTable = fileTable[index];
        path.shift();
    }
    
    while (path.length > 0 && path[0] !== "Table Entries") {
        console.log("fileTable is " + JSON.stringify(fileTable));
        index = ContainsName(fileTable.children, path[0], "name");
        refs.push({ ref: fileTable, index: index, first: false });
        fileTable = fileTable.children[index];
        path.shift();
    }
    if (path[0] === "Table Entries") {
        for (var entry in table.children) {
            if (table.children.hasOwnProperty(entry)) {
                index = ContainsName(fileTable.children, table.children[entry].name, "name");
                console.log("Index of property " + table.children[entry].name + " in " + JSON.stringify(fileTable.children) + " is " + index);
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
    console.log("Output: " + JSON.stringify(jsonFile.document.converted.guidata));
    fs.writeFileSync(path_module.join(tmpDirectory, configPath), JSON.stringify(jsonFile));

}

function UpdateTable(configPath, tablePath, data) {
    var file = GetData(configPath, tablePath);
    console.log("Table data is " + file);
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
    
    console.log("After replacement, table data is " + JSON.stringify(oldData));
    SetTable(configPath, tablePath, oldData);
}

function ValidatePath(path) {
    var re = /^[a-zA-Z0-9\-_]+$/;
    if (!path.match(re)) { return false; }
    
    return true;
}

function DiscardWorkingDir(path) {
    var trashPath = path_module.join(trashDirectory, path + "_" + Date.now());
    var configPath = path_module.join(tmpDirectory, path);
    console.log("trashPath: " + trashPath + ", configPath: " + configPath);
    
    
    if (!fs.existsSync(configPath)) {
        console.log("No changes detected, returning");
        return true;
    }
    
    console.log("Moving configuration temporary directory to TRASH directory");
    if (!fs.existsSync(trashDirectory)) {
        fs.mkdirSync(trashDirectory);
    }
    console.log("Moving config to trash: " + configPath + " to " + trashPath);
    fs.renameSync(configPath, trashPath);
    console.log("Returning...");
    return true;
}

function execSync(command) {
    // Run the command in a subshell
    child_process.exec(command + ' 2>&1 1>output && echo done! > done');
    
    // Block the event loop until the command has executed.
    while (!fs.existsSync('done')) {
// Do nothing
    }
    
    // Read the output
    var output = fs.readFileSync('output');
    
    // Delete temporary files.
    fs.unlinkSync('output');
    fs.unlinkSync('done');
    
    return output;
}

function copy(oldPath, newPath) {
    execSync("cp -a \"" + oldPath + "\" \"" + newPath + "\"");
}

function rmrf(path) {
    execSync("rm -rf \"" + path + "\"");
}

function SaveConfigurationChanges(oldPath, newPath) {
    var original = path_module.join(dbDirectory, oldPath);
    var modified = path_module.join(tmpDirectory, oldPath);
    var output = path_module.join(dbDirectory, newPath);
    console.log("Original: " + original + ", Modified: " + modified + ", Output: " + output);
    
    var originalMetadata = JSON.parse(ReadConfigurationMetadata(original));
    var newMetadata = JSON.parse(ReadConfigurationMetadata(modified));
    
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
    }
    WriteConfigurationMetadata(newMetadata, modified);
    
    if (oldPath === newPath) {
        console.log("Original will be overwritten. Saving copy to TRASH");
        copy(original, path_module.join(trashDirectory, oldPath));
    }
    
    console.log("Copying from " + modified + " to " + output);
    copy(modified, output);
    return DiscardWorkingDir(oldPath);
}

function WriteConfigurationMetadata(newMetadata, configPath) {
    
    var fileName = path_module.join(dbDirectory, configPath);
    if (fs.existsSync(configPath)) { fileName = configPath; }
    else if (fs.existsSync(path_module.join(tmpDirectory, configPath))) { fileName = path_module.join(tmpDirectory, configPath); }

    console.log("Reading file: " + fileName);
    var jsonFile = JSON.parse("" + fs.readFileSync(fileName));

    jsonFile.configurable_entity = newMetadata.configurable_entity;
    jsonFile.bookkeeping = newMetadata.bookkeeping;
    jsonFile.aliases = newMetadata.aliases;
    jsonFile.configurations = newMetadata.configurations;
    jsonFile.version = newMetadata.version;

    console.log("Writing data to file");
    fs.writeFileSync(fileName, JSON.stringify(jsonFile));
}

function ReadConfigurationMetadata(configPath) {
    console.log("Reading metadata from " + configPath);
    
    var fileName = path_module.join(dbDirectory, configPath);
    if (fs.existsSync(configPath)) { fileName = configPath; }
    else if (fs.existsSync(path_module.join(tmpDirectory, configPath))) { fileName = path_module.join(tmpDirectory, configPath); }
    
    var jsonFile = JSON.parse("" + fs.readFileSync(fileName));
    var metadata = { configurable_entity: jsonFile.configurable_entity, bookkeeping: jsonFile.bookkeeping, aliases: jsonFile.aliases, configurations: jsonFile.configurations, version: jsonFile.version };
    
    return JSON.stringify(metadata);
}

// POST calls
db.RO_GetData = function (post) {
    console.log(JSON.stringify(post));
    if (post.configName.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return "";
    }
    var tablePath = post.path;
    var configPath = post.configName + ".gui.json";
    return GetData(configPath, tablePath);
};

db.RW_saveConfig = function (post) {
    console.log("Request to save configuration recieved. Configuration data:");
    console.log(post);
    if (post.newConfigName.search("\\.\\.") >= 0 || post.oldConfigName.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return false;
    }
    
    console.log("Checking for Configuration Name or Path changes");
    var pathChanged = post.oldConfigName !== post.newConfigName;
    if (pathChanged) {
        console.log("Validating path change");
        if (!ValidatePath(post.newConfigName + ".gui.json")) {
            var time = Date.now();
            console.log("WARNING: Invalid path detected! I'm going to use " + post.oldConfigName + "_" + time + ".gui.json" + " instead!");
            post.newConfigName = post.oldConfigName + "_" + time;
        }
    }
    
    if (post.log === "") {
        console.log("Empty Log Detected: No changes were made!");
        if (pathChanged) {
            console.log("Path change detected. Copying old configuration to new directory.");
            copy(post.oldConfigName + ".gui.json", post.newConfigName + ".gui.json");
        }
    } else {
        console.log("Updating Configuration Files");
        SaveConfigurationChanges(post.oldConfigName + ".gui.json", post.newConfigName + ".gui.json");
    }
    
    
    return "";
};

db.RO_LoadNamedConfig = function (post) {
    console.log("Request for configuration with file name \"" + post.configName + ".gui.json" + "\" received.");
    
    if (post.configName.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return "";
    }
    
    var structure = GetDBStructure(post.configName + ".gui.json");
    console.log("Returning DB Structure: " + JSON.stringify(structure));
    return JSON.stringify(structure);
};

db.RW_discardConfig = function (post) {
    if (post.configName.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return false;
    }
    
    return DiscardWorkingDir(post.configName + ".gui.json");
}

db.RO_Update = function (post) {
    if (post.configName.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return false;
    }
    //console.log(JSON.stringify(post));
    UpdateTable(post.configName + ".gui.json", post.table, { id: post.id, name: post.name, column: post.column, value: post.value });
    return "";
}

db.RO_LoadConfigMetadata = function (post) {
    console.log(JSON.stringify(post));
    if (post.configName.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return false;
    }
    return ReadConfigurationMetadata(post.configName + ".gui.json");
}

// GET calls
db.GET_NamedConfigs = function () {
    var configs = GetNamedConfigs();
    //console.log(configs);
    var configsOutput = [];
    for (var conf in configs) {
        if (configs.hasOwnProperty(conf)) {
            if (conf) {
                var confName = configs[conf].slice(0, configs[conf].search(".gui.json"));
                configsOutput.push("<option value=" + confName + ">" + confName + "</option>");
            }
        }
    }
    //console.log(configsOutput);
    return configsOutput;
};

// Serverbase Module definition
db.MasterInitFunction = function (workerData) {
    var data = {};
    workerData["db"] = data;
    
    if (!fs.existsSync(tmpDirectory)) {
        fs.mkdirSync(tmpDirectory);
    }
};

module.exports = function (moduleHolder) {
    moduleHolder["db"] = db;
};