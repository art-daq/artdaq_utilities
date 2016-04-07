
// ReSharper disable PossiblyUnassignedProperty
var spawn = require("child_process").spawn;
var Emitter = require("events").EventEmitter;
var fs = require("fs");
var child_process = require("child_process");
var util = require("util");
var path_module = require("path");
var Utils = new Emitter();
// ReSharper restore PossiblyUnassignedProperty



/**
 * Creates a unique version of a name by incrementing the last number or appending the date
 * @param {string} name - Name to uniquify
 * @returns {string} Uniquified name 
 */
Utils.Uniquify = function(name) {
    if (name.search(/[\d]+/) >= 0) {
        var lastNumber = name.replace(/.*?([\d]+)[^\d]*$/g, "$1");
        console.log("Last number in string: " + lastNumber);
        var len = lastNumber.length;
        lastNumber++;
        for (var j = ("" + lastNumber).length; j < len; j++) {
            lastNumber = "0" + lastNumber;
        }
        console.log("After replacement: " + lastNumber);
        name = name.replace(/(.*?)([\d]+)([^\d]*)$/g, "$1" + lastNumber + "$3");
    } else {
        name = name + "_" + Date.now();
    }
    return name;
};


/**
 * Runs a command in a child process and waits for completion
 * @param {string} command - Command to run
 * @returns {string} Command Output 
 */
Utils.ExecSync = function(command) {
    // Run the command in a subshell
    child_process.exec(command + " 2>&1 1>output && echo done! > done || echo fail > done");
    
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
Utils.MoveFileSync = function(oldPath, newPath) {
    if (fs.existsSync(newPath)) {
        fs.unlinkSync(newPath);
    }
    
    fs.renameSync(oldPath, newPath);
}


/**
 * Checks that a path only contains alphanumeric characters, hyphens and underscores
 * @param {string} path - Path to check for invalid characters
 * @returns {Boolean} If the path is okay
 */
Utils.ValidatePath = function(path) {
    var re = /^[a-zA-Z0-9\-_]+$/;
    if (!path.match(re)) {
        return false;
    }
    
    return true;
}

/**
 * Searches a string array for a given value
 * @param {string[]} arr - Array to search
 * @param {string} val - Value to search for
 * @returns {Number} Index of value in array (-1 for no match)
 */
 Utils.ContainsString = function(arr, val) {
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
Utils.ContainsName = function(arr, val, name) {
    for (var i = 0; i < arr.length; i++) {
        //console.log("Checking if " + arr[i][name] + " is equal to " + val);
        if (arr[i][name] === val) {
            return i;
        }
    }
    return -1;
}


module.exports = Utils;