var Emitter = require('events').EventEmitter;
var daqmon = new Emitter();
var net = require('net');

var database = {
    data: {
        nodes: [
            { name: "BoardReader", width: 4 },
            { name: "EventBuilder", width: 4 },
            { name: "Aggregator", width: 3 },
            { name: "Online Monitor", width: 2 }
        ],
        links: [
            { source: "BoardReader", target: "EventBuilder", value: 0.5 },
            { source: "EventBuilder", target: "Aggregator", value: 0.5 },
            { source: "Aggregator", target: "Online Monitor", value: 0.4 }
        ]
    },
    metrics: {}
};
var locked = false;

function startGraphiteListener() {
    var server = net.createServer(function (socket) {
        socket.name = socket.remoteAddress + ":" + socket.remotePort;
        console.log("Received Graphite Client connection from " + socket.name);

        socket.on('data', function (data) {
            locked = true;
            var metrics = database.metrics;
            //console.log("Received metric data: " + data);
            var strdata = "" + data;
            var mm = strdata.split("\n");
            for (var m in mm) {
                if (mm.hasOwnProperty(m)) {
                    var arr = mm[m].trim().split(" ", 3);
                    if (arr[0] !== undefined && arr[1] !== undefined && arr[2] !== undefined) {
                        console.log("Metric: " + arr[0] + ": " + arr[1] + " at " + arr[2]);
                        if (metrics[arr[0]] === undefined) {
                            metrics[arr[0]] = [];
                        }
                        metrics[arr[0]].push({ value: arr[1], date: arr[2] });
                    }
                }
            }
            locked = false;
            daqmon.emit('message', {name: "artdaq-daqmon", target: "metrics", data: metrics});
        });

        socket.on('end', function() {
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
    console.log(JSON.stringify(workerData));
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
