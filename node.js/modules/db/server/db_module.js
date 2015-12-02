// db_module.js : Server-side bindings for DB Display module
// Author: Eric Flumerfelt, FNAL RSI
// Last Modified: October 30, 2015
//

// Node.js framework "includes"
var spawn = require('child_process').spawn;
var emitter = require('events').EventEmitter;
var fs = require('fs');
var child_process = require('child_process');
var util = require('util');
var path_module = require('path');
try {
    var fhiclPath = path_module.join(process.env["ARTDAQ_DATABASE_LIB"], "node_modules", "fhicljson");
    console.log("Looking for fhicljson module in " + fhiclPath);
    var fhicl = require(fhiclPath);
    console.log("Module loaded.");
} catch (e) {
    console.log("Error loading fhicljson module...have you setup the artdaq_database product?");
    console.log(e);
}
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
        console.log("Checking if " + arr[i][name] + " is equal to " + val);
        if (arr[i][name] === val) {
            return i;
        }
    }
    return -1;
}

function GetNamedConfigs(baseDir) {
    console.log("Searching for Named Configs in path " + baseDir);
    // we have a directory: do a tree walk
    var configs = [];
    var files = fs.readdirSync(baseDir);
    var f, l = files.length;
    for (var i = 0; i < l; i++) {
        f = path_module.join(baseDir, files[i]);
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
    console.log("Going to load FhiCL file: " + path);
    var json = fhicl.tojson(path);
    if (json.first) {
        var fcl = JSON.parse(json.second);
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

function GetDBStructure(configPath, baseDir) {
    var configs = GetNamedConfigs(baseDir);
    if (configs.length == 0) { return false; }
    var index = ContainsName(configs, configPath, "path");
    if (index < 0) {
        return false;
    }
    
    var output = [];
    var dir = path_module.join(baseDir, configPath);
    return ProcessDirectory(dir);
}

function GetTablePath(baseDir, configPath, tablePath) {
    var path = tablePath.split('/');
    var index = ContainsString(path, ".fcl");
    //console.log("Index is " + index);
    if (index >= 0) {
        var fhiclName = path[index];
        var fhiclOrigPath = path_module.join(baseDir, configPath);
        var fhiclTmpPath = path_module.join(baseDir, "..", "tmp", configPath);
        for (var i = 0; i <= index; ++i) {
            fhiclOrigPath = path_module.join(fhiclOrigPath, path[0]);
            fhiclTmpPath = path_module.join(fhiclTmpPath, path[0]);
            path.shift();
        }
        var fcl = ParseFhicl(fhiclOrigPath, fhiclName);
        //console.log(util.inspect(fcl, { depth: null }));
        while (path.length > 1) {
            index = ContainsName(fcl.children, path[0], "name");
            fhiclTmpPath = path_module.join(fhiclTmpPath, path[0]);
            fcl = fcl.children[index];
            path.shift();
        }
        console.log("Table name is " + path[0]);
        //console.log(fcl.tables);
        if (path[0] === "Table Entries") {
            fhiclTmpPath += ".json";
            if (fs.existsSync(fhiclTmpPath)) {
                return { name: fcl.name, output: fhiclTmpPath, contents: fs.readFileSync(fhiclTmpPath) };
            } else {
                return { name: fcl.name, output: fhiclTmpPath, contents: JSON.stringify(fcl.tables[0]) };
            }
        } else {
            var index = ContainsName(fcl.tables, path[0], "name");
            fhiclTmpPath = path_module.join(fhiclTmpPath, path[0] + ".json");
            if (fs.existsSync(fhiclTmpPath)) {
                return { name: path[0], output: fhiclTmpPath, contents: fs.readFileSync(fhiclTmpPath) };
            } else {
                return { name: fcl.tables[index].name, output: fhiclTmpPath, contents: JSON.stringify(fcl.tables[index]) };
            }
        }
    } else {
        var categoryPath = path_module.join(baseDir, configPath, path.join('/'));
        var outputPath = path_module.join(baseDir, "..", "tmp", configPath, path.join('/'));
        var tableName = path[path.length - 1];
        path = path.slice(0, -1);
        console.log(baseDir + "/" + configPath + "/" + path);
        var files = fs.readdirSync(categoryPath);
        var f, l = files.length;
        for (var i = 0; i < l; i++) {
            console.log("Processing File " + files[i]);
            f = path_module.join(categoryPath, files[i]);
            var g = path_module.join(outputPath, files[i]);
            if (!fs.lstatSync(f).isDirectory() && files[i].search(".json") > 0 && files[i].search("~") < 0) {
                var contents = "" + fs.readFileSync(f);
                if (JSON.parse(contents).name === tableName) {
                    return { name: f, output: g, contents: contents };
                }
            }
        }
    }
    return {};
}

function GetTable(baseDir, configPath, tablePath) {
    var file = GetTablePath(baseDir, configPath, tablePath);
    console.log("Returning: ");
    console.log(file.contents);
    return file.contents;
}

function UpdateTable(baseDir, configPath, tablePath, data) {
    var file = GetTablePath(baseDir, configPath, tablePath);
    var oldData = JSON.parse(file.contents);
    for (var entry in oldData.data) {
        if (oldData.data.hasOwnProperty(entry)) {
            if (data.name.search(oldData.data[entry].name) === 0) {
                if (data.name === oldData.data[entry].name) {
                    oldData.data[entry][data.column] = data.value;
                } else {
                    //Check for Fhicl Sequence:
                    for (var element in oldData.data[entry].children) {
                       if (oldData.data[entry].children[element].name === data.name) {
                            oldData.data[entry].children[element][data.column] = data.value;
                       }
                    }
                }
            }
        }
    }
    console.log("File.name is " + file.name + ", and file.output is " + file.output);
    var dirs = file.output.split('/');
    var createdPath = path_module.join(baseDir, "..");
    while (dirs.length > 1) {
        if (baseDir.search(dirs[0]) < 0) {
            createdPath = path_module.join(createdPath, dirs[0]);
            if (!fs.existsSync(createdPath)) {
                fs.mkdirSync(createdPath);
            }
        }
        dirs.shift();
    }
    
    fs.writeFileSync(file.output, JSON.stringify(oldData));
}

function CheckBaseDir(baseDir) {
    if (fs.existsSync(baseDir) && fs.lstatSync(baseDir).isDirectory() && GetNamedConfigs(baseDir).length > 0) {
        return true;
    }
    return false;
}

function ReadConfigMetadata(baseDir, configPath) {
    var mdFile = path_module.join(baseDir, configPath + ".json");
    if (fs.existsSync(mdFile)) {
        return JSON.parse(fs.readFileSync(mdFile));
    }
    return {};
}

function WriteConfigMetadata(baseDir, configPath, configName, log, oldConfigPath) {
    var metadata = ReadConfigMetadata(baseDir, oldConfigPath);
    metadata.baseDir = baseDir;
    metadata.name = configName;
    metadata.changeLog = log + metadata.changeLog;
    metadata.time = Date.now();
    
    fs.writeFileSync(path_module.join(baseDir, configPath + ".json"), JSON.stringify(metadata));
}

function ValidatePath(path, baseDir) {
    var re = /^[a-zA-Z0-9\-_]+$/;
    if (!path.match(re)) { return false; }
    if (fs.existsSync(path_module.join(baseDir, path))) { return false; }
    
    return true;
}

function FindDirectoryFiles(base, path) {
    var output = { files: [], dirs: [] };
    var files = fs.readdirSync(path);
    var f, l = files.length;
    for (var i = 0; i < l; i++) {
        console.log("Processing File " + files[i]);
        f = path_module.join(base, path, files[i]);
        if (fs.lstatSync(f).isDirectory()) {
            output.dirs.push(path_module.join(path, files[i]));
            output.files.push(FindDirectoryFiles(base, files[i]));
        } else {
            output.files.push(path_module.join(path, files[i]));
        }
    }
    return output;
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

function FindFhiclFiles(fileArray) {
    var fhiclFiles = [];
    for (var i = 0; i < fhiclFiles.length; ++i) {
        var filePath = fhiclFiles[i].split('/');
        var fhiclFile = "";
        for (var j = 0; j < filePath.length; ++j) {
            if (filePath[j].search(".fcl") >= 0) {
                fhiclFile = filePath[j];
                break;
            }
        }
        if (fhiclFile.length > 0 && ContainsString(fhiclFiles, fhiclFile) < 0) {
            fhiclFiles.push(fhiclFile);
        }
    }
    return fhiclFiles;
}

function MergeFhiclFiles(baseDir, oldPath, newPath) {
    var originalConfig = path_module.join(baseDir, oldPath);
    var tmpDirectory = path_module.join(baseDir, "..", "tmp", oldPath);
    var outputDirectory = path_module.join(baseDir, newPath);
    var pathChanged = oldPath !== newPath;
    
    var oldFiles = FindDirectoryFiles(originalConfig, "");
    var oldFhiclFiles = FindFhiclFiles(oldFiles);
    var modifiedFiles = FindDirectoryFiles(tmpDirectory, "");
    var modifiedFhiclFiles = FindFhiclFiles(modifiedFiles);
    
    // Copy over unmodified files
    if (pathChanged) {
        for (var i = 0; i < oldFhiclFiles.length; ++i) {
            if (ContainsString(modifiedFhiclFiles, oldFhiclFiles[i]) < 0) {
                var fileIndex = ContainsString(oldFiles, oldFhiclFiles[i]);
                copy(path_module.join(originalConfig, oldFiles[fileIndex]), path_module.join(outputDirectory, oldFiles[fileIndex]));
            }
        }
    }
    
    // Merge modified files
    for (var i = 0; i < modifiedFhiclFiles.length; ++i) {
        var fileName = modifiedFhiclFiles[i];
        var fileIndex = ContainsString(oldFiles, fileName);
        var oldFile = path_module.join(originalConfig, oldFiles[fileIndex]);
        var tmpJSON = fhicl.tojson(oldFile);
        var oldFileJSON = {};
        if (tmpJSON.first) {
            oldFileJSON = JSON.parse(tmpJSON.second);
        }
        
        for (var j = 0; j < modifiedFiles.length; ++j) {
            if (modifiedFiles[j].search(fileName) >= 0) {
                var thisTable = JSON.parse(fs.readFileSync(path_module.join(tmpDirectory, modifiedFiles[j])));
                
            }
        }
    }
}

function UpdateConfigurationData(baseDir, oldPath, newPath) {
    var originalConfig = path_module.join(baseDir, oldPath);
    var tmpDirectory = path_module.join(baseDir, "..", "tmp", oldPath);
    var outputDirectory = path_module.join(baseDir, newPath);
    
    var pathChanged = oldPath !== newPath;
    
    var oldFileList = FindDirectoryFiles(originalConfig, "");
    var modifiedFileObj = FindDirectoryFiles(tmpDirectory, "");
    var modifiedFileList = modifiedFileObj.files;
    var modifiedFileDirs = modifiedFileObj.dirs;
    
    var fhiclsModified = ContainsString(modifiedFileList, ".fcl");
    
    if (!fhiclsModified) {
        //We can do direct file overwriting
        if (pathChanged) {
            copy(originalConfig, outputDirectory);
        }
        for (var i = 0; i < modifiedFileDirs.length; ++i) {
            if (!fs.existsSync(path_module.join(outputDirectory, modifiedFileDirs[i]))) {
                fs.mkdirSync(path_module.join(outputDirectory, modifiedFileDirs[i]));
            }
        }
        for (var i = 0; i < modifiedFileList.length; ++i) {
            fs.unlinkSync(path_module.join(outputDirectory, modifiedFileList[i]));
            fs.renameSync(path_module.join(originalConfig, modifiedFileList[i]), path_module.join(outputDirectory, modifiedFileList[i]));
        }
    } else {
        // More complicated case.
        if (pathChanged) {
            fs.mkdirSync(outputDirectory);
            
            //Copy in original config files (that aren't fhicl)
            for (var i = 0; i < oldFileList.dirs.length; ++i) {
                if (!fs.existsSync(path_module.join(outputDirectory, oldFileList.dirs[i]))) {
                    fs.mkdirSync(path_module.join(outputDirectory, oldFileList.dirs[i]));
                }
            }
            for (var i = 0; i < oldFileList.files.length; ++i) {
                var oldFile = path_module.join(originalConfig, oldFileList.files[i]);
                if (oldFileList.files[i].search(".fcl") < 0) {
                    copy(oldFile, path_module.join(outputDirectory, oldFileList.files[i]));
                }
            }
        }
        
        // Copy in modified config files (that aren't fhicl)
        for (var i = 0; i < modifiedFileDirs.length; ++i) {
            if (!fs.existsSync(path_module.join(outputDirectory, modifiedFileDirs[i]))) {
                fs.mkdirSync(path_module.join(outputDirectory, modifiedFileDirs[i]));
            }
        }
        
        for (var i = 0; i < modifiedFileList.length; ++i) {
            if (modifiedFileList[i].search(".fcl") < 0) {
                fs.unlinkSync(path_module.join(outputDirectory, modifiedFileList[i]));
                fs.renameSync(path_module.join(originalConfig, modifiedFileList[i]), path_module.join(outputDirectory, modifiedFileList[i]));
            }
        }
        
        // Refactor out the hard bit...
        MergeFhiclFiles(baseDir, oldPath, newPath);
    }
}

db.MasterInitFunction = function (workerData) {
    var data = {};
    workerData["db"] = data;
};

module.exports = function (module_holder) {
    module_holder["db"] = db;
};

db.RO_NamedConfigs = function (POST) {
    var configs = GetNamedConfigs(POST.data);
    //console.log(configs);
    var configsOutput = [];
    for (var conf in configs) {
        if (conf) {
            configsOutput.push("<option value=" + configs[conf].path + ">" + configs[conf].name + "</option>");
        }
    }
    //console.log(configsOutput);
    return configsOutput;
};

db.RO_GetData = function (POST) {
    console.log(JSON.stringify(POST));
    var baseDir = POST.baseDir;
    var tablePath = POST.path;
    return GetTable(baseDir, POST.configInfo.path, tablePath);
};

db.RW_saveConfig = function (POST) {
    console.log("Request to save configuration recieved. Configuration data:");
    console.log(POST);
    if (!CheckBaseDir(POST.baseDir)) { return ""; }
    
    console.log("Checking for Configuration Name or Path changes");
    var nameChanged = POST.oldConfigInfo.name !== POST.newConfigInfo.name;
    var pathChanged = POST.oldConfigInfo.path !== POST.newConfigInfo.path;
    if (pathChanged) {
        console.log("Validating path change");
        if (!ValidatePath(POST.newConfigInfo.path, POST.baseDir)) {
            var time = Date.now();
            console.log("WARNING: Invalid path detected! I'm going to use " + POST.oldConfigInfo.path + "_" + time + " instead!");
            POST.newConfigInfo.path = POST.oldConfigInfo.path + "_" + time;
        }
    }
    
    if (POST.log === "") {
        if (pathChanged) {
            console.log("Path change detected. Copying old configuration to new directory.");
            var oldDir = path_module.join(POST.baseDir, POST.oldConfigInfo.path);
            var newDir = path_module.join(POST.baseDir, POST.newConfigInfo.path);
            copy(oldDir, newDir);
        }
        if (pathChanged || nameChanged) {
            console.log("Name Or Path Change detected. Re-writing metadata file");
            WriteConfigMetadata(POST.baseDir, POST.newConfigInfo.path, POST.newConfigInfo.name, POST.log, POST.oldConfigInfo.path);
        }
    } else {
        UpdateConfigurationData(POST.baseDir, POST.oldConfigInfo.path, POST.newConfigInfo.path);
        WriteConfigMetadata(POST.baseDir, POST.newConfigInfo.path, POST.newConfigInfo.name, POST.log, POST.oldConfigInfo.path);
    }
    
    
    return "";
};

db.RO_LoadNamedConfig = function (POST) {
    console.log("Request for configuration with file name \"" + POST.configInfo.path + "\" received.");
    
    if (!CheckBaseDir(POST.baseDir)) { return ""; }
    if (POST.configInfo.path.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return "";
    }
    
    var structure = GetDBStructure(POST.configInfo.path, POST.baseDir);
    structure.metadata = ReadConfigMetadata(POST.baseDir, POST.configInfo.path);
    //console.log("Returning DB Structure: " + JSON.stringify(structure));
    return JSON.stringify(structure);
};

db.RW_discardConfig = function (POST) {
    //console.log(workerData);
    //console.log(POST);
    if (!CheckBaseDir(POST.baseDir)) { return false; }
    if (POST.configInfo.path.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return false;
    }
    var index = ContainsName(GetNamedConfigs(POST.baseDir), POST.configInfo.path, "path");
    console.log("Array index is " + index);
    if (index >= 0) {
        var trashDir = path_module.join(POST.baseDir, "..", "TRASH");
        var trashPath = path_module.join(trashDir, POST.configInfo.path + "_" + Date.now());
        var configPath = path_module.join(POST.baseDir, "..", "tmp", POST.configInfo.path);
        
        if (!fs.existsSync(configPath)) {
            console.log("No changes detected, returning");
            return true;
        }
        
        console.log("Moving configuration temporary directory to TRASH directory");
        if (!fs.existsSync(trashDir)) {
            fs.mkdirSync(trashDir);
        }
        console.log("Moving config to trash: " + configPath + " to " + trashPath);
        fs.renameSync(configPath, trashPath);
        console.log("Returning...");
        return true;
    } else {
        // Config not found
        console.log("Returning false");
        return false;
    }
}

db.RO_SetBaseDirectory = function (POST) {
    return CheckBaseDir(POST.data);
}

db.RO_Update = function (POST) {
    if (!CheckBaseDir(POST.baseDir)) { return ""; }
    UpdateTable(POST.baseDir, POST.configInfo.path, POST.table, { id: POST.id, name: POST.name, column: POST.column, value: POST.value });
    return "";
}