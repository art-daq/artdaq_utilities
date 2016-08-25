var Emitter = require('events').EventEmitter;
var daqmon = new Emitter();
var net = require('net');

var config = {
    durationToStore: 300 // 5 Minutes
}

var database = {
    data: {
        nodes: [
            { name: "EventBuilders", width: 1, lastUpdate: Date.now(), repvalue: 0, unit: "Fragments/s" },
            { name: "Data_Logger", width: 1, lastUpdate: Date.now(), repvalue: 0, unit: "Fragments/s" },
            { name: "Online_Monitor", width: 1, lastUpdate: Date.now(), repvalue: 0, unit: "Fragments/s" }
        ],
        links: [
            { source: "Data_Logger", target: "Online_Monitor", value: 1 }
        ],
        metrics: {},
        avgFragRate: -1.0,
        fragRateCount: 0
    }
};
var locked = false;

function checkMetrics() {
    var now = Date.now();
    var then = now - config.durationToStore * 1000;
    for (var h in database.metrics) {
        if (database.metrics.hasOwnProperty(h)) {
            var metrics = database.metrics[h];
            for (var m in metrics) {
                if (metrics.hasOwnProperty(m)) {
                    var metric = metrics[m];
                    for (var i in metric) {
                        if (metric.hasOwnProperty(i)) {
                            if (metric[i].date < then) {
                                delete database.metrics[h][m][i];
                            } else {
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
}

function IndexOfSink(sinkName) {
    for (var i = 0; i < database.data.links.length; i++) {
        if (database.data.links[i].target === sinkName) { return i; }
    }
    return -1;
}

function IndexOfLink(sourceName) {
    for (var i = 0; i < database.data.links.length; i++) {
        if (database.data.links[i].source === sourceName) { return i; }
    }
    return -1;
}

function IndexOfNode(nodeName) {
    for (var i = 0; i < database.data.nodes.length; i++) {
        if (database.data.nodes[i].name === nodeName) { return i; }
    }
    return -1;
}

function startGraphiteListener() {
    var server = net.createServer(function (socket) {
        socket.name = socket.remoteAddress + ":" + socket.remotePort;
        console.log("Received Graphite Client connection from " + socket.name);
        
        socket.on('data', function (data) {
            locked = true;
            //console.log("Received metric data: " + data);
            var strdata = "" + data;
            var mm = strdata.split("\n");
            for (var m in mm) {
                if (mm.hasOwnProperty(m)) {
                    var arr = mm[m].trim().split(" ", 3);
                    if (arr[0] !== undefined && arr[1] !== undefined && arr[2] !== undefined) {
                        var dotNot = arr[0].split('.');
                        var appName = dotNot.shift();
                        var value = parseFloat(arr[1]);
                        if (dotNot.length > 0 && dotNot[0].search(/^[0-9]*$/) >= 0) {
                            appName += "." + dotNot.shift();
                        }
                        var metricName = "" + dotNot.join('.');
                        console.log("Application: " + appName + ", Metric: " + metricName + ": " + arr[1] + " at " + arr[2]);
                        if (database.data.metrics[appName] === undefined) {
                            database.data.metrics[appName] = {};
                        }
                        if (database.data.metrics[appName][metricName] === undefined) {
                            database.data.metrics[appName][metricName] = [];
                        }
                        database.data.metrics[appName][metricName].push({ value: arr[1], date: new Date(arr[2] * 1000) });
                        var br = appName.search("BoardReader") >= 0;
                        var eb = appName.search("EventBuilder") >= 0;
                        var nodeIndex = IndexOfNode(appName);
                        if (nodeIndex < 0) {
                            database.data.nodes.push({ name: appName, width: 1, lastUpdate: Date.now(), repvalue: 0, unit: "Fragments/s" });
                            if (br) {
                                database.data.links.push({ source: appName, target: "EventBuilders", value: 1 });
                            }
                            else if (eb) {
                                database.data.links.push({ source: "EventBuilders", target: appName, value: 1 });
                                database.data.links.push({ source: appName, target: "Data_Logger", value: 1 });
                            }
                            nodeIndex = IndexOfNode(appName);
                        }

                        //console.log("NodeIndex is " + nodeIndex);
                        database.data.nodes[nodeIndex].lastUpdate = Date.now();
                        
                        //console.log("Metric name is: " + metricName);
                        if (metricName.search("Data_Rate") >= 0) {
                            //console.log("Data_Rate Metric Found!!!");
                            var link = IndexOfLink(appName);
                            //console.log("Index of link is: " + link);
                            if (link >= 0) {
                                //console.log("Setting value to: " + value);
                                database.data.links[link].value = value;
                            }
                            if (eb) {
                                var sink = IndexOfSink(appName);
                                if (sink >= 0) {
                                    database.data.links[sink].value = value;
                                }
                            }
                        }
                        if (metricName.search("Fragment_Rate") >= 0) {
                            //console.log("Fragment_Rate Metric Found!!!");
                            if (nodeIndex >= 0) {
                                if (!eb) {
                                    if (database.data.avgFragRate === -1) {
                                        database.data.avgFragRate = value;
                                        database.data.fragRateCount = 1;
                                    } else {
                                        database.data.avgFragRate = (database.data.avgFragRate * database.data.fragRateCount + value) / (database.data.fragRateCount + 1);
                                        database.data.fragRateCount += 1;
                                    }
                                    database.data.nodes[nodeIndex].width = value / database.data.avgFragRate;
                                    database.data.nodes[nodeIndex].repvalue = value;
                                }
                            }
                        }
                        if (metricName.search("Incomplete_Event_Count") >= 0) {
                            if (nodeIndex >= 0) {
                                database.data.nodes[nodeIndex].width = value / database.data.avgFragRate;
                                database.data.nodes[nodeIndex].repvalue = value;
                                database.data.nodes[nodeIndex].unit = "Incomplete Events";
                            }
                        }
                    }
                }
            }
            locked = false;
            checkMetrics();
                daqmon.emit('message', { name: "artdaq-daqmon", target: "data", data: database.data });
        });
        
        socket.on('end', function () {
            console.log("Graphite Client Disconnected: " + socket.name);
        });
    });
    
    server.on("error", function (err) {
        console.log("artdaq-daqmon listen server error:\n" + err.stack);
        server.close();
    });
    
    console.log("Binding Server to port 2003 (Graphite Listen)");
    server.listen(2003);
}

daqmon.Update = function (workerData) {
    if (!locked) {
        //console.log("Updating database: " + JSON.stringify(workerData));
        database = workerData;
    }
}

daqmon.GET_Json = function (workerData) {
    //console.log(JSON.stringify(workerData));
    return JSON.stringify(workerData.data);
}

daqmon.MasterInitFunction = function (workerData) {
    
    workerData["artdaq-daqmon"] = database;
}

daqmon.WorkerInitFunction = function (workerData) {
    startGraphiteListener();
    return null;
}

module.exports = function (module_holder) {
    module_holder["artdaq-daqmon"] = daqmon;
};
