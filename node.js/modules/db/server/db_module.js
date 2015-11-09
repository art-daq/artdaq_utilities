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

function GetDBStructure(testData, configName) {
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
                        columns: [
                            { name: 'id', type: "number" },
                            { name: 'name', type: "string" },
                            { name: 'value', type: "number", radix: 16 },
                            { name: 'threshold', type: "number", radix: 10 },
                            { name: 'parent', type: "number" }
                        ],
                        key: 'id',
                        parent: 'parent',
                        data: [
                            { id: 0, name: "Full System", value: 0x00000001, threshold: 0 },
                            { id: 1, name: "dcm-1-01-01", value: 0x00000002, threshold: 0, parent: 0 },
                            { id: 2, name: "FEB 0", value: 0xFFFFFFFF, threshold: 100, parent: 1 },
                            { id: 3, name: "FEB 1", value: 0xF0F0F0F0 , threshold: 101, parent: 1 },
                            { id: 4, name: "FEB 2", value: 0xFF00FF00, threshold: 102, parent: 1 },
                            { id: 5, name: "FEB 3", value: 0xFFFF0000, threshold: 103, parent: 1 },
                            { id: 6, name: "dcm-1-01-02", value: 0x00000003 , threshold: 0, parent: 0 },
                            { id: 7, name: "FEB 0", value: 0xFFFFFFFF , threshold: 200, parent: 6 },
                            { id: 8, name: "FEB 1", value: 0xF0F0F0F0 , threshold: 201 , parent: 6 },
                            { id: 9, name: "FEB 2", value: 0xFF00FF00 , threshold: 202, parent: 6 },
                            { id: 10, name: "FEB 3", value: 0xFFFF0000 , threshold: 203, parent: 6 },
                            { id: 11, name: "dcm-1-01-03", value: 0x00000004, threshold: 0, parent: 0 },
                            { id: 12, name: "FEB 0", value: 0xFFFFFFFF , threshold: 300 , parent: 11 },
                            { id: 13, name: "FEB 1", value: 0xF0F0F0F0 , threshold: 301 , parent: 11 },
                            { id: 14, name: "FEB 2", value: 0xFF00FF00 , threshold: 302, parent: 11 },
                            { id: 15, name: "FEB 3", value: 0xFFFF0000, threshold: 303 , parent: 11 }
                        ]
                    },
                    {
                        name: "Table B",
                        columns: [
                            { name: 'id', type: "number" },
                            { name: 'name', type: "string" },
                            { name: 'value', type: "number", radix: 16 },
                            { name: 'threshold', type: "number", radix: 10 },
                            { name: 'parent', type: "number" }
                        ],
                        key: 'id',
                        parent: 'parent',
                        data: [
                            { id: 0, name: "Full System", value: 0x00000010 },
                            { id: 1, name: "dcm-1-01-01", value: 0x00000020, parent: 0 },
                            { id: 2, name: "FEB 0", value: 0xFFFFFFFF, threshold: 100, parent: 1 },
                            { id: 3, name: "FEB 1", value: 0xF0F0F0F0 , threshold: 101, parent: 1 },
                            { id: 4, name: "FEB 2", value: 0xFF00FF00, threshold: 102, parent: 1 },
                            { id: 5, name: "FEB 3", value: 0xFFFF0000, threshold: 103, parent: 1 },
                            { id: 6, name: "dcm-1-01-02", value: 0x00000030 , parent: 0 },
                            { id: 7, name: "FEB 0", value: 0xFFFFFFFF , threshold: 200, parent: 6 },
                            { id: 8, name: "FEB 1", value: 0xF0F0F0F0 , threshold: 201 , parent: 6 },
                            { id: 9, name: "FEB 2", value: 0xFF00FF00 , threshold: 202, parent: 6 },
                            { id: 10, name: "FEB 3", value: 0xFFFF0000 , threshold: 203, parent: 6 },
                            { id: 11, name: "dcm-1-01-03", value: 0x00000040, parent: 0 },
                            { id: 12, name: "FEB 0", value: 0xFFFFFFFF , threshold: 300 , parent: 11 },
                            { id: 13, name: "FEB 1", value: 0xF0F0F0F0 , threshold: 301 , parent: 11 },
                            { id: 14, name: "FEB 2", value: 0xFF00FF00 , threshold: 302, parent: 11 },
                            { id: 15, name: "FEB 3", value: 0xFFFF0000, threshold: 303 , parent: 11 }
                        ]
                    }
                ]
            },
            {
                name: "Category 2",
                tables: [
                    {
                        name: "Table C",
                        columns: [
                            { name: 'id', type: "number" },
                            { name: 'name', type: "string" },
                            { name: 'value', type: "number", radix: 16 },
                            { name: 'threshold', type: "number", radix: 10 },
                            { name: 'parent', type: "number" }
                        ],
                        key: 'id',
                        parent: 'parent',
                        data: [
                            { id: 0, name: "Full System", value: 0x00000100 },
                            { id: 1, name: "dcm-1-01-01", value: 0x00000200, parent: 0 },
                            { id: 2, name: "FEB 0", value: 0xFFFFFFFF, threshold: 100, parent: 1 },
                            { id: 3, name: "FEB 1", value: 0xF0F0F0F0 , threshold: 101, parent: 1 },
                            { id: 4, name: "FEB 2", value: 0xFF00FF00, threshold: 102, parent: 1 },
                            { id: 5, name: "FEB 3", value: 0xFFFF0000, threshold: 103, parent: 1 },
                            { id: 6, name: "dcm-1-01-02", value: 0x00000300 , parent: 0 },
                            { id: 7, name: "FEB 0", value: 0xFFFFFFFF , threshold: 200, parent: 6 },
                            { id: 8, name: "FEB 1", value: 0xF0F0F0F0 , threshold: 201 , parent: 6 },
                            { id: 9, name: "FEB 2", value: 0xFF00FF00 , threshold: 202, parent: 6 },
                            { id: 10, name: "FEB 3", value: 0xFFFF0000 , threshold: 203, parent: 6 },
                            { id: 11, name: "dcm-1-01-03", value: 0x00000400, parent: 0 },
                            { id: 12, name: "FEB 0", value: 0xFFFFFFFF , threshold: 300 , parent: 11 },
                            { id: 13, name: "FEB 1", value: 0xF0F0F0F0 , threshold: 301 , parent: 11 },
                            { id: 14, name: "FEB 2", value: 0xFF00FF00 , threshold: 302, parent: 11 },
                            { id: 15, name: "FEB 3", value: 0xFFFF0000, threshold: 303 , parent: 11 }
                        ]
                    },
                    {
                        name: "Table D",
                        columns: [
                            { name: 'id', type: "number" },
                            { name: 'name', type: "string" },
                            { name: 'value', type: "number", radix: 2},
                            { name: 'threshold', type: "number", radix: 10 },
                            { name: 'parent', type: "number" }
                        ],
                        key: 'id',
                        parent: 'parent',
                        data: [
                            { id: 0, name: "Full System", value: 0x00001000 },
                            { id: 1, name: "dcm-1-01-01", value: 0x00002000, parent: 0 },
                            { id: 2, name: "FEB 0", value: 0xFFFFFFFF, threshold: 100, parent: 1 },
                            { id: 3, name: "FEB 1", value: 0xF0F0F0F0 , threshold: 101, parent: 1 },
                            { id: 4, name: "FEB 2", value: 0xFF00FF00, threshold: 102, parent: 1 },
                            { id: 5, name: "FEB 3", value: 0xFFFF0000, threshold: 103, parent: 1 },
                            { id: 6, name: "dcm-1-01-02", value: 0x00003000 , parent: 0 },
                            { id: 7, name: "FEB 0", value: "0xFFFFFFFF" , threshold: 200, parent: 6 },
                            { id: 8, name: "FEB 1", value: 0xF0F0F0F0 , threshold: 201 , parent: 6 },
                            { id: 9, name: "FEB 2", value: 0xFF00FF00 , threshold: 202, parent: 6 },
                            { id: 10, name: "FEB 3", value: 0xFFFF0000 , threshold: 203, parent: 6 },
                            { id: 11, name: "dcm-1-01-03", value: 0x00004000, parent: 0 },
                            { id: 12, name: "FEB 0", value: 0xFFFFFFFF , threshold: 300 , parent: 11 },
                            { id: 13, name: "FEB 1", value: 0xF0F0F0F0 , threshold: 301 , parent: 11 },
                            { id: 14, name: "FEB 2", value: 0xFF00FF00 , threshold: 302, parent: 11 },
                            { id: 15, name: "FEB 3", value: 0xFFFF0000, threshold: 303 , parent: 11 }
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


db.GET_NamedConfigs = function (testData) {
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
    return JSON.stringify(workerData[POST.config].categories[POST.category].tables[POST.table]);
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

db.RO_Update = function (POST, testData) {
    console.log(JSON.stringify(POST));
}