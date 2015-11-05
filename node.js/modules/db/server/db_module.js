// db_module.js : Server-side bindings for DB Display module
// Author: Eric Flumerfelt, FNAL RSI
// Last Modified: October 30, 2015
//

// Node.js framework "includes"
var spawn = require('child_process').spawn;
var emitter = require('events').EventEmitter;
var db = new emitter();

function GetNamedConfigs(testData) {
    var configs = [];
    for (var config in testData) {
        configs.push(testData[config].name);
    }
    return configs;
}

function GetDBStructure(testData, configName)
{
    var thisConfig = testData[configName];
    var output = [];

    for (var cat in thisConfig.categories) {
        var thisCat = thisConfig.categories[cat];
        var catData = {};
        catData.name = thisCat.name;
        catData.tables = [];
        for (var tab in thisCat.tables) {
            var thisTab = thisCat.tables[tab];
            catData.tables.push(thisTab.name);
        }

        output.push(catData);
    }

    return output;
}

function GetTable(dbdata, tableID) {

}

var makeTestData = function () {
    var data = {
        name: "Default",
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
                        name: "Table A",
                        data: [
                            { name: "Full System", value: 0x00000001 },
                            { name: "Full System/dcm-1-01-01", value: 0x00000002 },
                            { name: "Full System/dcm-1-01-01/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-01/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-01/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-01/FEB 3", value: 0xFFFF0000 },
                            { name: "Full System/dcm-1-01-02", value: 0x00000003 },
                            { name: "Full System/dcm-1-01-02/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-02/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-02/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-02/FEB 3", value: 0xFFFF0000 },
                            { name: "Full System/dcm-1-01-03", value: 0x00000004 },
                            { name: "Full System/dcm-1-01-03/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-03/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-03/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-03/FEB 3", value: 0xFFFF0000 },
                        ]
                    },
                    {
                        name: "Table B",
                        data: [
                            { name: "Full System", value: 0x00000010 },
                            { name: "Full System/dcm-1-01-01", value: 0x00000020 },
                            { name: "Full System/dcm-1-01-01/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-01/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-01/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-01/FEB 3", value: 0xFFFF0000 },
                            { name: "Full System/dcm-1-01-02", value: 0x00000030 },
                            { name: "Full System/dcm-1-01-02/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-02/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-02/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-02/FEB 3", value: 0xFFFF0000 },
                            { name: "Full System/dcm-1-01-03", value: 0x00000040 },
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
                        name: "Table C",
                        data: [
                            { name: "Full System", value: 0x00000100 },
                            { name: "Full System/dcm-1-01-01", value: 0x00000200 },
                            { name: "Full System/dcm-1-01-01/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-01/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-01/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-01/FEB 3", value: 0xFFFF0000 },
                            { name: "Full System/dcm-1-01-02", value: 0x00000300 },
                            { name: "Full System/dcm-1-01-02/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-02/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-02/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-02/FEB 3", value: 0xFFFF0000 },
                            { name: "Full System/dcm-1-01-03", value: 0x00000400 },
                            { name: "Full System/dcm-1-01-03/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-03/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-03/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-03/FEB 3", value: 0xFFFF0000 },
                        ]
                    },
                    {
                        name: "Table D",
                        data: [
                            { name: "Full System", value: 0x00001000 },
                            { name: "Full System/dcm-1-01-01", value: 0x00002000 },
                            { name: "Full System/dcm-1-01-01/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-01/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-01/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-01/FEB 3", value: 0xFFFF0000 },
                            { name: "Full System/dcm-1-01-02", value: 0x00003000 },
                            { name: "Full System/dcm-1-01-02/FEB 0", value: 0xFFFFFFFF },
                            { name: "Full System/dcm-1-01-02/FEB 1", value: 0xF0F0F0F0 },
                            { name: "Full System/dcm-1-01-02/FEB 2", value: 0xFF00FF00 },
                            { name: "Full System/dcm-1-01-02/FEB 3", value: 0xFFFF0000 },
                            { name: "Full System/dcm-1-01-03", value: 0x00004000 },
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
    var arr = [];
    arr.push(data);
    return arr;
}

db.MasterInitFunction = function (workerData) {
    var data = new makeTestData();
    workerData["db"] = data;
};

module.exports = function (module_holder) {
    module_holder["db"] = db;
};


db.GET_NamedConfigs = function ( testData ) {
    var configs = GetNamedConfigs(testData);
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

db.RO_GetData = function (POST, workerData) {
    console.log(JSON.stringify(POST));
    return JSON.stringify(workerData[POST.config].categories[POST.category].tables[POST.table].data);
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
    testData[config.name] = config;
    return { Success: success };
};

db.RO_LoadNamedConfig = function (POST, testData) {
    console.log("Request for configuration with file name \"" + POST.configFile + "\" received.");
    if (POST.configFile.search("\\.\\.") >= 0) {
        console.log("Possible break-in attempt! NOT Proceeding!");
        return "";
    }
    
    return JSON.stringify(GetDBStructure(testData, POST.configFile));

};