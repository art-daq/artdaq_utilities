// db_module.js : Server-side bindings for DB Display module
// Author: Eric Flumerfelt, FNAL RSI
// Last Modified: October 30, 2015
//

// Node.js framework "includes"
var spawn = require('child_process').spawn;
var emitter = require('events').EventEmitter;
var db = new emitter();

function GetNamedConfigs() {
    var configs = [];
    configs.push("Default");
    return configs;
}

function GetCategories(dbdata) {
    var categories = [];
    categories.push("Category 1");
    categories.push("Category 2");
    return categories;
}

function GetTables(dbdata) {

}

function GetTable(dbdata, tableID) {

}

var makeTestData = function () {
    var data = {
        name: "Test Config",
        detector: "NearDet",
        mode: "DCS",
        time: "Latest",
        db: {
            host: "novadaq-near-db-01.fnal.gov",
            name: "nova_prod",
            user: "novadaq"
        },
        categories: [
            {
                name: "Category 1",
                tables: [
                    {
                        name: "first_table",
                        data: [
                            { name: "Full System", value: 0x00000000 },
                            { name: "Full System/dcm-1-01-01", value: 0x00000000 },
                            { name: "Full System/dcm-1-01-01/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-01/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-01/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-01/FEB 3", value: 0xFFFF0000 },
                            { name: "Full System/dcm-1-01-02", value: 0x00000000 },
                            { name: "Full System/dcm-1-01-02/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-02/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-02/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-02/FEB 3", value: 0xFFFF0000 },
                            { name: "Full System/dcm-1-01-03", value: 0x00000000 },
                            { name: "Full System/dcm-1-01-03/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-03/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-03/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-03/FEB 3", value: 0xFFFF0000 },
                        ]
                    },
                    {
                        name: "second_table",
                        data: [
                            { name: "Full System", value: 0x00000000 },
                            { name: "Full System/dcm-1-01-01", value: 0x00000000 },
                            { name: "Full System/dcm-1-01-01/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-01/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-01/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-01/FEB 3", value: 0xFFFF0000 },
                            { name: "Full System/dcm-1-01-02", value: 0x00000000 },
                            { name: "Full System/dcm-1-01-02/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-02/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-02/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-02/FEB 3", value: 0xFFFF0000 },
                            { name: "Full System/dcm-1-01-03", value: 0x00000000 },
                            { name: "Full System/dcm-1-01-03/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-03/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-03/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-03/FEB 3", value: 0xFFFF0000 },
                        ]
                    }
                ]
            },
            {
                name: "Category 2",
                tables: [
                    {
                        name: "first_table",
                        data: [
                            { name: "Full System", value: 0x00000000 },
                            { name: "Full System/dcm-1-01-01", value: 0x00000000 },
                            { name: "Full System/dcm-1-01-01/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-01/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-01/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-01/FEB 3", value: 0xFFFF0000 },
                            { name: "Full System/dcm-1-01-02", value: 0x00000000 },
                            { name: "Full System/dcm-1-01-02/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-02/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-02/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-02/FEB 3", value: 0xFFFF0000 },
                            { name: "Full System/dcm-1-01-03", value: 0x00000000 },
                            { name: "Full System/dcm-1-01-03/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-03/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-03/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-03/FEB 3", value: 0xFFFF0000 },
                        ]
                    },
                    {
                        name: "second_table",
                        data: [
                            { name: "Full System", value: 0x00000000 },
                            { name: "Full System/dcm-1-01-01", value: 0x00000000 },
                            { name: "Full System/dcm-1-01-01/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-01/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-01/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-01/FEB 3", value: 0xFFFF0000 },
                            { name: "Full System/dcm-1-01-02", value: 0x00000000 },
                            { name: "Full System/dcm-1-01-02/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-02/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-02/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-02/FEB 3", value: 0xFFFF0000 },
                            { name: "Full System/dcm-1-01-03", value: 0x00000000 },
                            { name: "Full System/dcm-1-01-03/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-03/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-03/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-03/FEB 3", value: 0xFFFF0000 },
                        ]
                    }
                ]
            }
        ]
    };
    
    return data;
}

db.MasterInitFunction = function (workerData) {
    var data = new makeTestData();
    workerData["db"] = data;
};

module.exports = function (module_holder) {
    module_holder["db"] = db;
};


db.GET_NamedConfigs = function () {
    var configs = GetNamedConfigs();
    console.log(configs);
    var configsOutput = [];
    for (var conf in configs) {
        if (conf) {
            configsOutput.push("<option value=" + conf + ">" + configs[conf] + "</option>");
        }
    }
    console.log(configsOutput)
    return configsOutput;
};

db.GET_Categories = function (workerData) {
    return JSON.stringify(GetCategories(workerData));
};

db.RO_GetTables = function (POST, workerData) {

};

db.RW_GetData = function (POST, workerData) {

};

db.RW_saveConfig = function (POST, testData) {
    var success = false;
    console.log("Request to save configuration recieved. Configuration data:");
    var config = JSON.parse(POST.config);
    if (config.name.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return { Success: false };
    }
    console.log(util.inspect(config, false, null));
    testData = config;
    return { Success: success };
};

db.RO_LoadNamedConfig = function (POST, testData) {
    console.log("Request for configuration with file name \"" + POST.configFile + "\" received.");
    if (POST.configFile === "Default") {
        return JSON.stringify(testData);
    } else if (POST.configFile.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return "";
    }
    
    return JSON.stringify(testData);
};