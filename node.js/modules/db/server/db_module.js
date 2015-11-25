// db_module.js : Server-side bindings for DB Display module
// Author: Eric Flumerfelt, FNAL RSI
// Last Modified: October 30, 2015
//

// Node.js framework "includes"
var spawn = require('child_process').spawn;
var emitter = require('events').EventEmitter;
var fs = require('fs');
var util = require('util');
var path_module = require('path');
var fhicl = require('./fhicljson');
var db = new emitter();
var configCache = {};

var fhiclTableTemplate = {
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
            name: "children",
            type: "array",
            editable: false,
            display: false
        }
    ],
    data: [],
    comment: "comment"
};

function GetNamedConfigs(configPath) {
    console.log("Searching for Named Configs in path " + configPath);
    // we have a directory: do a tree walk
    var configs = [];
    var files = fs.readdirSync(configPath);
    var f, l = files.length;
    for (var i = 0; i < l; i++) {
        f = path_module.join(configPath, files[i]);
        if (fs.lstatSync(f).isDirectory() && fs.existsSync(f + ".json")) {
            configs.push({ name: JSON.parse(fs.readFileSync(f + ".json")).name, path: path_module.basename(f) });
        }
    }
    return configs;
}

function ParseSequence(element, name) {
    element.children = [];
    for (var i in element.value) {
        element.children.push({ name: name + ":" + i, value: element.value[i] });
    }
    element.value = "";
    return element;
}

function ParseFhiclTable(table, name) {
    var output = { name: name, values: [], children: [], tables: [] }
    //console.log("Table name is " + name);
    
    for (var e in table) {
        var element = table[e];
        //console.log(element);
        switch (element.type) {
            case "table":
                //console.log("Parsing table " + e);
                output.children.push(ParseFhiclTable(element.value, e));
                break;
            case "sequence":
                output.values.push(ParseSequence(element, e));
                output.values[output.values.length - 1].name = e;
                break;
            case "number":
            case "string":
            case "bool":
                output.values.push(element);
                output.values[output.values.length - 1].name = e;
                break;
            default:
                console.log("Unknown type " + element.type + " encountered!");
                break;
        }
    }
    var newTable;
    var value;
    if (output.children.length > 0 && output.values.length > 0) {
        newTable = JSON.parse(JSON.stringify(fhiclTableTemplate));
        newTable.name = "Table Entries";
        
        for (value in output.values) {
            newTable.data.push(output.values[value]);
        }
        output.tables.push(newTable);
    }
    else if (output.children.length > 0) {
        var modified = true;
        while (modified) {
            modified = false;
            for (var i in output.children) {
                if (output.children[i].children.length === 0) {
                    newTable = JSON.parse(JSON.stringify(fhiclTableTemplate));
                    newTable.name = output.children[i].name;
                    
                    for (value in output.children[i].values) {
                        newTable.data.push(output.children[i].values[value]);
                    }
                    
                    output.tables.push(newTable);
                    output.children.splice(i, 1);
                    modified = true;
                    break;
                }
            }
        }
    }
    return output;
}

function ParseFhicl(path, name) {
    var json = fhicl.tojson(path);
    if (json.first) {
        //console.log("JSON:");
        //console.log(json);
        var fcl = JSON.parse(json.second);
        //console.log(util.inspect(fcl, { depth: null }));
        
        return ParseFhiclTable(fcl.data, name);
    }
    
    return { name: name, tables: [], children: [] };
}

function ProcessDirectory(path) {
    var output = {
        name: path_module.basename(path),
        tables: [],
        children: []
    };
    var files = fs.readdirSync(path);
    var f, l = files.length;
    for (var i = 0; i < l; i++) {
        console.log("Processing File " + files[i]);
        f = path_module.join(path, files[i]);
        if (fs.lstatSync(f).isDirectory()) {
            console.log("Adding Directory " + f + " to children list");
            output.children.push(ProcessDirectory(f));
        } else if (files[i].search(".json") > 0 && files[i].search("~") < 0) {
            var contents = JSON.parse(fs.readFileSync(f));
            console.log("Adding Table " + contents.name + " to tables list");
            output.tables.push(contents.name);
        } else if (files[i].search(".fcl") > 0 && files[i].search("~") < 0) {
            var fhiclcontents = ParseFhicl(f, files[i]);
            console.log("Adding Fhicl File " + fhiclcontents.name + " to tables list");
            output.children.push(fhiclcontents);
        }
    }
    return output;
}

function GetDBStructure(configName, workerData) {
    var configs = GetNamedConfigs(workerData.configPath);
    if (configs.length == 0) { return false; }
    var found = false;
    for (var c in configs) {
        if (configs[c].path === configName) {
            found = true;
        }
    }
    if (!found) { return false; }
    
    var output = [];
    var dir = path_module.join(workerData.configPath, configName);
    return ProcessDirectory(dir);
}

function ContainsString(arr, val) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i].search(val) >= 0) {
            return i;
        }
    }
    return -1;
}

function ContainsName(arr, val) {
    for (var i = 0; i < arr.length; i++) {
        console.log("Checking if " + arr[i].name + " is equal to " + val);
        if (arr[i].name === val) {
            return i;
        }
    }
    return -1;
}

function GetTablePath(configsPath, configName, tablePath) {
    var path = tablePath.split('/');
    var index = ContainsString(path, ".fcl");
    //console.log("Index is " + index);
    if (index >= 0) {
        var fhiclName = path[index];
        var fhiclPath = configsPath + "/" + configName;
        for (var i = 0; i <= index; ++i) {
            fhiclPath += "/" + path[0];
            path.shift();
        }
        var fcl = ParseFhicl(fhiclPath, fhiclName);
        //console.log(util.inspect(fcl, { depth: null }));
        while (path.length > 1) {
            index = ContainsName(fcl.children, path[0]);
            fcl = fcl.children[index];
            path.shift();
        }
        console.log("Table name is " + path[0]);
        console.log(fcl.tables);
        if (path[0] === "Table Entries") {
            return { name: fcl.name, contents: JSON.stringify(fcl.tables[0]) };
        } else {
            var index = ContainsName(fcl.tables, path[0]);
            return { name: fcl.tables[index].name, contents: JSON.stringify(fcl.tables[index]) };
        }
    } else {
        var tableName = path[path.length - 1];
        path = path.slice(0, -1);
        console.log(configsPath + "/" + configName + "/" + path);
        var categoryPath = path_module.join(configsPath, configName, path.join('/'));
        var files = fs.readdirSync(categoryPath);
        var f, l = files.length;
        for (var i = 0; i < l; i++) {
            console.log("Processing File " + files[i]);
            var f = path_module.join(categoryPath, files[i]);
            if (!fs.lstatSync(f).isDirectory() && files[i].search(".json") > 0 && files[i].search("~") < 0) {
                var contents = "" + fs.readFileSync(f);
                if (JSON.parse(contents).name === tableName) {
                    return { name: f, contents: contents };
                }
            }
        }
    }
    return {};
}

function GetTable(configsPath, configName, tablePath) {
    var file = GetTablePath(configsPath, configName, tablePath);
    console.log("Returning: ");
    console.log(file.contents);
    return file.contents;
}

function UpdateTable(configsPath, configName, tablePath, data) {
    var file = GetTablePath(configsPath, configName, tablePath);
    var oldData = JSON.parse(file.contents);
    for (var entry in oldData.data) {
        if (oldData.data[entry].id == data.id && oldData.data[entry].name == data.name) {
            oldData.data[entry][data.column] = data.value;
        }
    }
    fs.writeFileSync(file.name, JSON.stringify(oldData));
}

db.MasterInitFunction = function (workerData) {
    var data = {};
    workerData["db"] = data;
};

module.exports = function (module_holder) {
    module_holder["db"] = db;
};


db.RO_NamedConfigs = function (POST, workerData) {
    var configs = GetNamedConfigs(POST.data);
    console.log(configs);
    var configsOutput = [];
    for (var conf in configs) {
        if (conf) {
            configsOutput.push("<option value=" + configs[conf].path + ">" + configs[conf].name + "</option>");
        }
    }
    console.log(configsOutput);
    return configsOutput;
};

db.RO_GetData = function (POST, workerData) {
    console.log(JSON.stringify(POST));
    var configPath = POST.configPath;
    var configName = POST.config;
    var tablePath = POST.path;
    return GetTable(configPath, configName, tablePath);
};

db.RW_saveConfig = function (POST, workerData) {
    var success = false;
    console.log("Request to save configuration recieved. Configuration data:");
    var config = JSON.parse(POST.config);
    if (config.name.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return { Success: false };
    }
    console.log(util.inspect(config, false, null));
    testData[config.name] = config;
    return { Success: success };
};

db.RO_LoadNamedConfig = function (POST, workerData) {
    console.log("Request for configuration with file name \"" + POST.configFile + "\" received.");
    
    if (fs.existsSync(POST.configPath) && fs.lstatSync(POST.configPath).isDirectory() && GetNamedConfigs(POST.configPath).length > 0) {
        workerData.configPath = POST.configPath;
    } else {
        return "";
    }
    if (POST.configFile.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return "";
    }
    
    var structure = GetDBStructure(POST.configFile, workerData);
    //console.log("Returning DB Structure: " + JSON.stringify(structure));
    return JSON.stringify(structure);

};

db.RO_ConfigPath = function (POST, workerData) {
    console.log(JSON.stringify(POST));
    if (fs.existsSync(POST.data) && fs.lstatSync(POST.data).isDirectory() && GetNamedConfigs(POST.data).length > 0) {
        workerData.configPath = POST.data;
        return true;
    }
    
    return false;
}

db.RO_Update = function (POST, workerData) {
    console.log(JSON.stringify(POST));
    UpdateTable(POST.configPath, POST.config, POST.table, { id: POST.id, name: POST.name, column: POST.column, value: POST.value });
    return "";
}