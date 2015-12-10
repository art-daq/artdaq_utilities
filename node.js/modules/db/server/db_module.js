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
            name: "values",
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
        //console.log("Checking if " + arr[i][name] + " is equal to " + val);
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

function ParseFhiclTable(table) {
    var tables = [];
    var children = [];
    var atoms = [];
    //console.log("Table name is " + name);
    
    for (var e in table.children) {
        if (table.children.hasOwnProperty(e)) {
            var element = table.children[e];
            //console.log(element);
            switch (element.type) {
                case "table":
                    //console.log("Parsing table " + e);
                    children.push(ParseFhiclTable(element));
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
    
    if (atoms.length > 0) {
        newTable = JSON.parse(JSON.stringify(fhiclTableTemplate));
        newTable.name = "Table Entries";
        
        for (var atom in atoms) {
            if (atoms.hasOwnProperty(atom)) {
                newTable.data.push(atoms[atom]);
            }
        }
        tables.push(newTable);
    }
    if (children.length > 0) {
        var modified = true;
        while (modified) {
            modified = false;
            for (var i in children) {
                if (children.hasOwnProperty(i)) {
                    if (children[i].children.length === 0 && children[i].tables.length === 1 && children[i].tables[0].name === "Table Entries") {
                        newTable = JSON.parse(JSON.stringify(children[i].tables[0]));
                        newTable.name = children[i].name;
                        
                        tables.splice(-1, 0, newTable);
                        children.splice(i, 1);
                        modified = true;
                        break;
                    }
                }
            }
        }
    }
    var comment = table.comment ? table.comment : "";
    return { name: table.name, tables: tables, children: children, comment: comment };
}

function ParseFhicl(path, name) {
    console.log("Going to load FhiCL file: " + path);
    if (path.search(".fcl.json") >= 0) {
        console.log("This file has already been fhicljson converted. Doing minimal processing");
        var fcl = JSON.parse("" + fs.readFileSync(path));
        
        console.log(JSON.stringify(fcl));
        return ParseFhiclTable({ children: fcl.data, name: name });
    }
    var json = fhicl.tojson(path);
    if (json.first) {
        //console.log("DEBUG: " + json.second);
        var fcl = JSON.parse(json.second);
        return ParseFhiclTable({ children: fcl.data, name: name });
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
        } else if (files[i].search(".fcl") > 0 && files[i].search("~") < 0) {
            var fhiclcontents = ParseFhicl(f, files[i]);
            console.log("Adding Fhicl File " + fhiclcontents.name + " to tables list");
            //console.log("DEBUG: " + JSON.stringify(fhiclcontents));
            output.children.push(fhiclcontents);
        } else if (files[i].search(".json") > 0 && files[i].search("~") < 0) {
            var contents = JSON.parse(fs.readFileSync(f));
            console.log("Adding Table " + contents.name + " to tables list");
            output.tables.push(contents.name);
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
        
        var index = ContainsName(fcl.tables, path[0], "name");
        fhiclTmpPath = path_module.join(fhiclTmpPath, path[0] + ".json");
        if (fs.existsSync(fhiclTmpPath)) {
            console.log("Going to read from temporary file " + fhiclTmpPath);
            return { name: path[0], output: fhiclTmpPath, contents: "" + fs.readFileSync(fhiclTmpPath) };
        } else {
            return { name: fcl.tables[index].name, output: fhiclTmpPath, contents: JSON.stringify(fcl.tables[index]) };
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
    //console.log("Searching table for entry");
    for (var entry in oldData.data) {
        if (oldData.data.hasOwnProperty(entry)) {
            var index = data.name.search(oldData.data[entry].name);
            //console.log("Checking if " + data.name + " contains " + oldData.data[entry].name + " (" + index + ")");
            if (index === 0) {
                if (data.name === oldData.data[entry].name) {
                    //console.log("Setting " + oldData.data[entry] + " field " + data.column + " to " + data.value);
                    oldData.data[entry][data.column] = data.value;
                } else {
                    //Check for Fhicl Sequence:
                    var values = oldData.data[entry].values;
                    for (var element in values) {
                        if (values.hasOwnProperty(element)) {
                            //console.log("SEQUENCE: Checking if " + values[element].name + " is equal to " + data.name);
                            if (values[element].name === data.name) {
                                //console.log("Setting " + values[element] + " field " + data.column + " to " + data.value);
                                values[element][data.column] = data.value;
                            }
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
            //console.log("Checking and creating: " + createdPath);
            if (!fs.existsSync(createdPath)) {
                fs.mkdirSync(createdPath);
            }
        }
        dirs.shift();
    }
    
    //console.log("Writing output to file: " + JSON.stringify(oldData));
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
    console.log("Reading old Configuration Metadata:");
    var metadata = ReadConfigMetadata(baseDir, oldConfigPath);
    console.log(JSON.stringify(metadata));
    metadata.baseDir = baseDir;
    metadata.name = configName;
    if (log && log.length > 0) {
        metadata.changeLog = log + metadata.changeLog;
    }
    metadata.time = Date.now();
    
    console.log("Writing new metadata file: " + path_module.join(baseDir, configPath + ".json"));
    fs.writeFileSync(path_module.join(baseDir, configPath + ".json"), JSON.stringify(metadata));
}

function ValidatePath(path, baseDir) {
    var re = /^[a-zA-Z0-9\-_]+$/;
    if (!path.match(re)) { return false; }
    //if (fs.existsSync(path_module.join(baseDir, path))) { return false; }
    
    return true;
}

function FindDirectoryFiles(base, path) {
    //console.log("Finding files in " + base + " (" + path + ")");
    var output = { files: [], dirs: [] };
    var files = fs.readdirSync(path_module.join(base, path));
    var f, ff, l = files.length;
    for (var i = 0; i < l; i++) {
        //console.log("Processing File " + files[i]);
        f = path_module.join(base, path, files[i]);
        ff = path_module.join(path, files[i]);
        if (fs.lstatSync(f).isDirectory()) {
            output.dirs.push(ff);
            var dirInfo = FindDirectoryFiles(base, ff);
            output.files = output.files.concat(dirInfo.files);
            output.dirs = output.dirs.concat(dirInfo.dirs);
        } else {
            output.files.push(ff);
        }
    }
    //console.log("Returning: " + JSON.stringify(output));
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
    //console.log("Searching for FhiCL file names in " + JSON.stringify(fileArray));
    var fhiclFiles = [];
    for (var i = 0; i < fileArray.length; ++i) {
        //console.log("Processing file: " + fileArray[i]);
        var filePath = fileArray[i].split('/');
        var index = ContainsString(filePath, ".fcl");
        var fhiclFile = "";
        for (var j = 0; j <= index; ++j) {
            fhiclFile = path_module.join(fhiclFile, filePath[j]);
        }
        //console.log("Detected FhiCL File Name: " + fhiclFile);
        if (fhiclFile.length > 0 && ContainsString(fhiclFiles, fhiclFile) < 0) {
            fhiclFiles.push(fhiclFile);
        }
    }
    //console.log("Returning: " + JSON.stringify(fhiclFiles));
    return fhiclFiles;
}

function MergeFhiclFiles(baseDir, oldPath, newPath) {
    console.log("Merging FhiCL files");
    var originalConfig = path_module.join(baseDir, oldPath);
    var tmpDirectory = path_module.join(baseDir, "..", "tmp", oldPath);
    var outputDirectory = path_module.join(baseDir, newPath);
    var pathChanged = oldPath !== newPath;
    
    var oldFiles = FindDirectoryFiles(originalConfig, "").files;
    var oldFhiclFiles = FindFhiclFiles(oldFiles);
    var modifiedFiles = FindDirectoryFiles(tmpDirectory, "").files;
    var modifiedFhiclFiles = FindFhiclFiles(modifiedFiles);
    
    // Copy over unmodified files
    if (pathChanged) {
        console.log("Path was changed. Copying in untouched source fhicl files");
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
        var newFile = path_module.join(outputDirectory, oldFiles[fileIndex]);
        var tmpJSON = fhicl.tojson(oldFile);
        var tmpJSONObj = {};
        var oldFileJSON = { name: fileName, type: "table" };
        if (tmpJSON.first) {
            tmpJSONObj = JSON.parse(tmpJSON.second);
        }
        
        oldFileJSON.children = tmpJSONObj.data;
        
        console.log(JSON.stringify(modifiedFiles));
        for (var j = 0; j < modifiedFiles.length; ++j) {
            //console.log("Processing file: " + modifiedFiles[j]);
            if (modifiedFiles[j].search(fileName) >= 0) {
                var tablePath = modifiedFiles[j].slice(fileName.length + 1);
                console.log("Table Path: " + tablePath + ", fileName: " + fileName + ", modifiedFiles[j]: " + modifiedFiles[j]);
                var thisTable = JSON.parse(fs.readFileSync(path_module.join(tmpDirectory, modifiedFiles[j])));
                
                var thisTableArr = tablePath.split('/');
                var objects = [];
                var thisFileObj = oldFileJSON;
                while (thisTableArr.length > 1) {
                    var oldFileObj = thisFileObj;
                    var index = ContainsName(thisFileObj.children, thisTableArr[0], "name");
                    thisFileObj = thisFileObj.children[index];
                    objects.push({ index: index, item: oldFileObj });
                    thisTableArr.shift();
                }
                
                if (thisTableArr[0] !== "Table Entries.json") {
                    var name = thisTableArr[0].slice(0, -5);
                    var index = ContainsName(thisFileObj.children, name, "name");
                    objects.push({ index: index, item: thisFileObj });
                    thisFileObj = thisFileObj.children[index];
                }
                //console.log(JSON.stringify(objects));
                
                console.log("OLD: ");
                console.log(JSON.stringify(thisFileObj));
                console.log("NEW: ");
                
                for (var item in thisTable.data) {
                    if (thisTable.data.hasOwnProperty(item)) {
                        if (thisTable.data[item].type === "sequence") {
                            var values = thisTable.data[item].values;
                            for (var child in values) {
                                if (values.hasOwnProperty(child)) {
                                    if (values[child].annotation.length > 0) {
                                        thisTable.data[item].annotation += "(" + child + ": " + values[child].annotation + ")";
                                    }
                                    values[child] = values[child].value;
                                }
                            }
                        }
                    }
                }
                
                var strippedTable = { type: "table", name: thisTable.name, children: thisTable.data }
                console.log(JSON.stringify(strippedTable));
                
                if (thisTableArr[0] === "Table Entries.json") {
                    for (var entry in thisFileObj.children) {
                        if (thisFileObj.children.hasOwnProperty(entry)) {
                            if (thisFileObj.children[entry].type !== "table") {
                                if (strippedTable.children.length > 0) {
                                    thisFileObj.children.splice(entry, 1, strippedTable.children.shift());
                                }
                            }
                        }
                    }
                } else {
                    thisFileObj = strippedTable;
                }
                
                for (var k = objects.length - 1; k >= 0; --k) {
                    objects[k].item.children[objects[k].index] = thisFileObj;
                    thisFileObj = objects[k].item;
                }

            }
        }
        //console.log(JSON.stringify(oldFileJSON));
        
        //Give to Gennadiy!
        var origin = tmpJSONObj.origin;
        origin.source = "artdaq_config_editor";
        origin.timestamp = (new Date).toString();
        var comments = tmpJSONObj.comments;
        var jsonObj = JSON.stringify({ data: oldFileJSON.children, origin: origin, comments: comments });
        console.log("Converting back to FhiCL...");
        fhicl.tofhicl(newFile, jsonObj);
        console.log("Also writing JSON output");
        fs.writeFileSync(newFile + ".json", jsonObj);
    }
}

function DiscardWorkingDir(baseDir, path) {
    var index = ContainsName(GetNamedConfigs(baseDir), path, "path");
    console.log("Array index is " + index);
    if (index >= 0) {
        var trashDir = path_module.join(baseDir, "..", "TRASH");
        var trashPath = path_module.join(trashDir, path + "_" + Date.now());
        var configPath = path_module.join(baseDir, "..", "tmp", path);
        console.log("trashDir: " + trashDir + ", trashPath: " + trashPath + ", confgiPath: " + configPath);
        
        
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

function UpdateConfigurationData(baseDir, oldPath, newPath) {
    var originalConfig = path_module.join(baseDir, oldPath);
    var tmpDirectory = path_module.join(baseDir, "..", "tmp", oldPath);
    var outputDirectory = path_module.join(baseDir, newPath);
    //.log("Original Configuration Directory: " + originalConfig);
    //console.log("Temporary Configuration Directory: " + tmpDirectory);
    //console.log("Output Configuration Directory: " + outputDirectory);
    
    var pathChanged = oldPath !== newPath;
    
    var oldFileList = FindDirectoryFiles(originalConfig, "");
    var modifiedFileObj = FindDirectoryFiles(tmpDirectory, "");
    var modifiedFileList = modifiedFileObj.files;
    var modifiedFileDirs = modifiedFileObj.dirs;
    //console.log(JSON.stringify(oldFileList));
    //console.log(JSON.stringify(modifiedFileObj));
    
    var fhiclsModified = ContainsString(modifiedFileList, ".fcl") >= 0;
    
    if (!fhiclsModified) {
        console.log("No FhiCL Files were changed. Doing direct copy");
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
        console.log("FhiCL Files were changed. Copying in any other files.");
        if (pathChanged) {
            console.log("Path was changed. Creating output Directory");
            if (!fs.existsSync(outputDirectory)) {
                fs.mkdirSync(outputDirectory);
            }
            
            //Copy in original config files (that aren't fhicl)
            console.log("Recreating Directory Structure");
            for (var i = 0; i < oldFileList.dirs.length; ++i) {
                if (!fs.existsSync(path_module.join(outputDirectory, oldFileList.dirs[i]))) {
                    console.log("Creating directory " + path_module.join(outputdirectory, oldFileList.dirs[i]));
                    fs.mkdirSync(path_module.join(outputDirectory, oldFileList.dirs[i]));
                }
            }
            console.log("Copying in old non-FhiCL files");
            for (var i = 0; i < oldFileList.files.length; ++i) {
                var oldFile = path_module.join(originalConfig, oldFileList.files[i]);
                if (oldFileList.files[i].search(".fcl") < 0) {
                    copy(oldFile, path_module.join(outputDirectory, oldFileList.files[i]));
                }
            }
        }
        
        // Copy in modified config files (that aren't fhicl)
        for (var i = 0; i < modifiedFileDirs.length; ++i) {
            if (modifiedFileDirs[i].search(".fcl") < 0) {
                var dir = path_module.join(outputDirectory, modifiedFileDirs[i]);
                console.log("Checking if Directory exists: " + dir);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir);
                }
            }
        }
        
        for (var i = 0; i < modifiedFileList.length; ++i) {
            if (modifiedFileList[i].search(".fcl") < 0) {
                console.log("Copying file " + modifiedFileList[i] + " to output directory");
                fs.unlinkSync(path_module.join(outputDirectory, modifiedFileList[i]));
                fs.renameSync(path_module.join(originalConfig, modifiedFileList[i]), path_module.join(outputDirectory, modifiedFileList[i]));
            }
        }
        
        // Refactor out the hard bit...
        MergeFhiclFiles(baseDir, oldPath, newPath);
    }
    return DiscardWorkingDir(baseDir, oldPath);
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
        console.log("Empty Log Detected: No changes were made!");
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
        console.log("Updating Configuration Files");
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
    
    return DiscardWorkingDir(POST.baseDir, POST.configInfo.path);
}

db.RO_SetBaseDirectory = function (POST) {
    return CheckBaseDir(POST.data);
}

db.RO_Update = function (POST) {
    if (!CheckBaseDir(POST.baseDir)) { return ""; }
    UpdateTable(POST.baseDir, POST.configInfo.path, POST.table, { id: POST.id, name: POST.name, column: POST.column, value: POST.value });
    return "";
}