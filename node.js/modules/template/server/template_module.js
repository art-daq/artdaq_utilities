//template_module.js: Skeleton code for serverbase.js modules
var Emitter = require('events').EventEmitter;
var t = new Emitter();

var module_name = "template";

t.MasterInitFunction = function(workerData) {
    workerData[module_name] = "Template Placeholder";
    return null;
};

t.WorkerInitFunction = function(workerData) { return null; }

t.Update = function (moduleData) { return null; }

module.exports = function (moduleHolder) {
    moduleHolder[module_name] = t;
};
