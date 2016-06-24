var testData;
var defaultColor = "";
var defaultShadow = "";
var tableHTML;
var infoHTML;
var radixButtonHTML;
var treeGridHTML;
var currentNamedConfig = "";
var currentMetadata;
var currentTable;
var lastTabID = 1;
var editedValues = [];
var exportTarFileName = "export";
//var userId = generateUUID();
// For Testing
var userId = "1";

function generateUUID() {
    var d = Date.now();
    if (window.performance && typeof window.performance.now === "function") {
        d += performance.now(); //use high-precision timer if available
    }
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
};

function updateHeader(error, change, text) {
    if (error) {
        $("#header").css("background-color", "#D59595").css("text-shadow", '#D99 0 1px 0');
        $("#info").text(text);
        text = "ERROR: " + text;
    } else if (change) {
        $("#header").css("background-color", "#E7F29B").css("text-shadow", '#EF9 0 1px 0');
        $("#info").text(text);
        text = "CHANGE: " + text;
    } else {
        $("#header").css("background-color", defaultColor).css("text-shadow", defaultShadow);
        $("#info").text(text);
    }
    if (text.length > 0) {
        console.log(text);
    }
};

function resizeTextAreas() {
    $("textarea").each(function (i, el) {
        $(el).height(el.scrollHeight);
    });
};

function createRowEditor(row, cellvalue, editor, cellText, width, height) {
    editor.after("<div></div><div></div>");
    var radix = 10;
    if (typeof cellText === "string" && cellText.search("0x") === 0) {
        cellText = cellText.slice(2);
        cellvalue = cellvalue.slice(2);
        radix = 16;
        if (("" + cellText).search(/[^0-9a-fA-F]/) >= 0) { return; }
    } else if (typeof cellText === "string" && cellText.search("0") === 0) {
        cellText = cellText.slice(1);
        cellvalue = cellvalue.slice(1);
        radix = 8;
        if (isNaN(cellText)) { return; }
    } else if (typeof cellText === "string" && cellText.search("b") === cellText.length - 1) {
        cellText = cellText.slice(0, -1);
        cellvalue = cellvalue.slice(0, -1);
        radix = 2;
        if (isNaN(cellText)) { return; }
    } else if (isNaN(cellText)) {
        return;
    }
    if (cellText === " " || ("" + cellText).length === 0 || ("" + cellText).indexOf(".") >= 0) {
        return;
    }
    editor.parent().jqxFormattedInput({ radix: radix, value: cellvalue, width: width, height: height, upperCase: true, dropDown: true, spinButtons: true });
};

function initRowEditor(row, cellvalue, editor) {
    editor.parent().val(cellvalue);
};

function getRowEditorValue(row, cellvalue, editor) {
    if (editor.parent()) {
        if (editor.val().search("000") === 0 || editor.val().length === 0) {
            editor.parent().parent().empty();
            return "";
        }
        var radix = editor.parent().jqxFormattedInput("radix");
        if (radix === 2 || radix === "binary") {
            return editor.val() + "b";
        }
        if (radix === 16 || radix === "hexadecimal") {
            return "0x" + editor.val().toUpperCase();
        }
        if (radix === 8 || radix === "octal") {
            if (editor.val()[0] === '0') {
                return editor.val();
            }
            return "0" + editor.val();
        }
        if (editor.val().search("000") === 0) {
            editor.parent().parent().empty();
            return "";
        }
    }
    return editor.val();
};

function makeTreeGrid(tag, displayColumns, dataFields, data) {
    tag.html(treeGridHTML);
    var grid = tag.find("#treeGrid");
    var contextMenu = tag.find("#Menu");
    var dialog = tag.find("#dialog");
    // prepare the data
    console.log("Data is " + JSON.stringify(data));
    console.log("DisplayColumns is " + JSON.stringify(displayColumns));
    console.log("DataFields is " + JSON.stringify(dataFields));
    var source = {
        dataType: "json",
        dataFields: dataFields,
        hierarchy: {
            root: "values"
        },
        id: "name",
        localData: data,
        comment: "comment"
    };
    // ReSharper disable once InconsistentNaming
    var dataAdapter = new $.jqx.dataAdapter(source, {
        beforeLoadComplete: function (records) {
            var numberFields = [];
            for (var c in source.dataFields) {
                if (source.dataFields.hasOwnProperty(c)) {
                    if (source.dataFields[c].dataType === "number") {
                        numberFields.push({ name: source.dataFields[c].name, radix: source.dataFields[c].radix });
                    }
                }
            }
            for (var i in records) {
                if (records.hasOwnProperty(i)) {
                    var edited = false;
                    for (var j in editedValues) {
                        if (editedValues.hasOwnProperty(j)) {
                            if (editedValues[j].grid === grid) {
                                if (editedValues[j].rowData.id === i) {
                                    edited = true;
                                }
                            }
                        }
                    }
                    records[i]["edited"] = edited;
                    for (var f in numberFields) {
                        if (numberFields.hasOwnProperty(f)) {
                            var radix = numberFields[f].radix;
                            if (!radix) {
                                radix = 10;
                            }
                            var value = records[i][numberFields[f].name];
                            if (value) {
                                if (typeof value === "number" || !(value.search("0x") === 0 || value.search("0") === 0 || value.search("b") === value.length - 1)) {
                                    
                                    value = parseInt(value).toString(radix).toUpperCase();
                                    records[i][numberFields[f].name] = value;
                                    if (radix === 2) {
                                        records[i][numberFields[f].name] += "b";
                                    }
                                    if (radix === 16) {
                                        records[i][numberFields[f].name] = "0x" + value;
                                    }
                                    if (radix === 8) {
                                        records[i][numberFields[f].name] = "0" + value;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return records;
        }
    });
    // create Tree Grid
    grid.addClass("jqxTreeGrid").jqxTreeGrid(
        {
            width: "100%",
            source: dataAdapter,
            sortable: true,
            columnsResize: true,
            columns: displayColumns,
            rendered: function () {
                $(".jqx-tooltip").remove();
                var setupRow = function (rowObject) {
                    if (rowObject[source.comment] && rowObject[source.comment].length > 0 && rowObject[source.comment] !== " ") {
                        var selector = $("tr[data-key=\'" + rowObject.uid + "\']");
                        if (selector.length) {
                            selector.jqxTooltip({ content: rowObject[source.comment], position: "mouse" });
                        }
                    }
                    for (var trow in rowObject.records) {
                        if (rowObject.records.hasOwnProperty(trow)) {
                            setupRow(rowObject.records[trow]);
                        }
                    }
                };
                var rows = grid.jqxTreeGrid("getRows");
                for (var ttrow = 0; ttrow < rows.length; ttrow++) {
                    setupRow(rows[ttrow]);
                }
            },
            ready: function () {
                dialog.find("#save").jqxButton({ height: 30, width: 80 });
                dialog.find("#cancel").jqxButton({ height: 30, width: 80 });
                dialog.find("#cancel").mousedown(function () {
                    dialog.jqxWindow('close');
                });
                dialog.find("#save").mousedown(function () {
                    dialog.jqxWindow('close');
                    var editRow = parseInt(dialog.attr('data-row'));
                    var rowData = {
                    };
                    grid.jqxTreeGrid('updateRow', editRow, rowData);
                });
                dialog.on('close', function () {
                    // enable jqxTreeGrid.
                    grid.jqxTreeGrid({ disabled: false });
                });
                dialog.jqxWindow({
                    resizable: false,
                    width: 270,
                    position: { left: grid.offset().left + 75, top: grid.offset().top + 35 },
                    autoOpen: false
                });
                dialog.css('visibility', 'visible');
            }
        });

    // create context menu
    contextMenu.jqxMenu({ width: 200, height: 87, autoOpenPopup: false, mode: 'popup' });
    grid.on('contextmenu', function () {
        return false;
    });
    grid.on('rowClick', function (event) {
        var args = event.args;
        if (args.originalEvent.button == 2) {
            var scrollTop = $(window).scrollTop();
            var scrollLeft = $(window).scrollLeft();
            contextMenu.jqxMenu('open', parseInt(event.args.originalEvent.clientX) + 5 + scrollLeft, parseInt(event.args.originalEvent.clientY) + 5 + scrollTop);
            return false;
        }
    });
    var edit = function(row, key) {
        // update the widgets inside jqxWindow.
        dialog.jqxWindow('setTitle', "Edit Row: " + row.name);
        dialog.jqxWindow('open');
        dialog.attr('data-row', key);
        // disable jqxTreeGrid.
        grid.jqxTreeGrid({ disabled: true });
    }
    grid.on('rowDoubleClick', function (event) {
        var args = event.args;
        var key = args.key;
        var row = args.row;
        edit(row, key);
    });
    contextMenu.on('itemclick', function (event) {
        var args = event.args;
        var selection = grid.jqxTreeGrid('getSelection');
        var rowid = selection[0].uid;
        var text = $.trim($(args).text());
        if (text === "Edit Selected Row") {
            edit(selection[0], rowid);
        } else if (text === "Delete Selected Row") {
            grid.jqxTreeGrid('deleteRow', rowid);
        } else {
        }
    });

    // Cell End Edit
    grid.on("cellEndEdit", function (event) {
        var args = event.args;
        // row key
        var rowKey = args.key;
        // row's data.
        var rowData = args.row;
        var columnDataField = args.dataField;
        // column name
        var columnName = args.dataField;
        for (var i in args.owner._columns) {
            if (args.owner._columns.hasOwnProperty(i)) {
                if (args.owner._columns[i].dataField === columnName) {
                    columnName = args.owner._columns[i].text;
                    break;
                }
            }
        }
        grid.jqxTreeGrid("getRow", rowKey)["edited"] = true;
        editedValues.push({ grid: grid, rowKey: rowKey, rowData: rowData });
        $("li.active :visible").parent().addClass("editedValue");
        // cell's value.
        var value = args.value;
        AjaxPost("/db/Update", {
            configName: currentNamedConfig,
            table: currentTable,
            column: columnDataField,
            id: rowData.id,
            name: rowData.name,
            value: value,
            user: userId
        }, function (retval) {
            if (retval.Success) {
                var now = new Date;
                var selector = $("#changes", $(".file-tab.active a").attr("href"));
                selector.val(now.toISOString() + ": Edit - Table: " + currentTable + ", Name: " + rowData.name + ", Column: " + columnName + ", Value: " + value + "\n" + selector.val());
                $("#masterChanges").val(now.toISOString() + ": Edit - Table: " + currentTable + ", Name: " + rowData.name + ", Column: " + columnName + ", Value: " + value + "\n" + $("#masterChanges").val());
                resizeTextAreas();
                updateHeader(false, true, "There are pending unsaved changes. Please save or discard before closing the editor!");
            } else {
                updateHeader(true, false, "Sending Update to server failed");
            }
        });
    });
};

function cellClass(row, dataField, cellText, rowData) {
    var edited = rowData["edited"];
    if (edited) {
        return "editedValue";
    }
    return "value";
};

function loadTable(path, tag) {
    currentTable = path;
    AjaxPost("/db/GetData", { configName: currentNamedConfig, path: path, user: userId }, function (data) {
        if (!data.Success) {
            updateHeader(true, false, "Fetch of data from database failed");
            return;
        }
        var columns = data.data.columns;
        
        var displayColumns = [];
        
        for (var c in columns) {
            if (columns.hasOwnProperty(c)) {
                var title = columns[c].title;
                if (title === undefined || title === null || title.length === 0) {
                    title = columns[c].name.charAt(0).toUpperCase() + columns[c].name.slice(1);
                }
                if (columns[c].type === "string" && columns[c].display) {
                    displayColumns.push({
                        text: title,
                        dataField: columns[c].name,
                        editable: columns[c].editable,
                        createEditor: createRowEditor,
                        initEditor: initRowEditor,
                        getEditorValue: getRowEditorValue,
                        cellClassName: cellClass
                    });
                } else if (columns[c].type === "number" && columns[c].display) {
                    columns[c].type = "string";
                    columns[c].dataType = "number";
                    displayColumns.push({
                        text: title,
                        dataField: columns[c].name,
                        editable: columns[c].editable,
                        createEditor: createRowEditor,
                        initEditor: initRowEditor,
                        getEditorValue: getRowEditorValue,
                        cellClassName: cellClass
                    });
                }
            }
        }
        
        makeTreeGrid(tag, displayColumns, columns, data.data.children); //.trigger('create');

    });
};

function getConfigList() {
    updateHeader(false, false, "");
    $("#masterChanges").val("");
    resizeTextAreas();
    for (var i = 2; i <= lastTabID; i++) {
        $("#tab" + i).remove();
        $("#tablink" + i).remove();
    }

    $("#reloadConfigsButton").text("Reload Configurations");

    AjaxPost("/db/NamedConfigs", { configFilter: $("#configurationFilter").val(), user: userId }, function (data) {
        if (!data.Success) {
            updateHeader(true, false, "Error retrieving Configuration list. Please contact an expert!");
            return;
        }
        $("#configs").html(data.data.join("")).trigger("create").selectmenu("refresh");
        var config = getUrlParameter("configs");
        if (config !== undefined) {
            $("#configs").val(config);
        }
        $("#oldConfigName").html(data.data.join("")).trigger("create").selectmenu("refresh");
        $("#exportConfigName").html(data.data.join("")).trigger("create").selectmenu("refresh");
    });
    $("#configLoad").collapsible("option", "disabled", false).collapsible("option", "collapsed", false);
    $("#configSave").collapsible("option", "disabled", true).collapsible("option", "collapsed", true);
    $("#configMetadata").collapsible("option", "disabled", true).collapsible("option", "collapsed", true);
    $("#exportFile").collapsible("option", "collapsed", true);
    $("#newConfig").collapsible("option", "collapsed", true);
};

function registerTabFunctions() {
    $(".tabs .table-data a").off();
    $(".tabs .tab-links a").off().on("click", function (e) {
        var currentAttrValue = $(this).attr("href");
        
        // Show/Hide Tabs
        $(".tabs " + currentAttrValue).show().siblings().hide();
        
        // Change/remove current tab to active
        $(this).parent("li").addClass("active").siblings().removeClass("active");
        
        e.preventDefault();
    });
    $(".table-data a").on("click", function () {
        var path = [];
        $("li.active :visible").each(function (index, item) {
            path.push(item.firstChild.textContent);
        });
        console.log(path.join("/"));
        loadTable(path.join("/"), $(".tabs " + $(this).attr("href")));
    });
    $(".file-tab a").on("click", function () {
        var fileName = $(this).text();
        var parentTab = $(this).attr("href").substring(4);
        loadFile(fileName, parentTab);
        resizeTextAreas();
    });
    $(".info-tab a").on("click", function () {
        var fileName = [];
        $("li.active :visible").each(function (index, item) {
            fileName.push(item.firstChild.textContent);
        });
        console.log(fileName[0] + ".gui.json");
        loadFileMetadata(fileName[0], $(this).attr("href"));
        resizeTextAreas();
    });
};

function createTabLevel(structureObj, parentTab) {
    var categoryObj = structureObj.children;
    for (var cat in categoryObj) {
        if (categoryObj.hasOwnProperty(cat)) {
            var name = categoryObj[cat].name;
            if (name.length === 0) { name = categoryObj[cat]; }
            if (categoryObj[cat].hasSubtables) {
                lastTabID++;
                $("#tab" + parentTab + " #tabLinks").first().append("<li id=\"tablink" + lastTabID + "\"><a href=\"#tab" + lastTabID + "\">" + name + "</a></li>");
                $("#tab" + parentTab + " #tabContents").first().append("<div id=tab" + lastTabID + " class=\"tab\"></div>");
                $("#tab" + lastTabID).html(tableHTML);
                createTabLevel(categoryObj[cat], lastTabID);
            } else {
                lastTabID++;
                $("#tab" + parentTab + " #tabLinks").first().append("<li id=\"tablink" + lastTabID + "\" class=\"table-data\"><a href=\"#tab" + lastTabID + "\">" + name + "</a></li>");
                $("#tab" + parentTab + " #tabContents").first().append("<div id=tab" + lastTabID + " class=\"tab\"></div>");
            }
        }
    }
};

function getUrlParameter(sParam) {
    var sUrlVariables = window.location.search.substring(1).split("&");
    //console.log("sUrlVariables: " + sUrlVariables);
    for (var i = 0; i < sUrlVariables.length; i++) {
        var sParameterName = sUrlVariables[i].split("=");
        //console.log("Comparing " + sParam + " to " + sParameterName[0] + " (" + sParameterName[1] + ")");
        if (sParameterName[0].search(sParam) >= 0) {
            //console.log("Returning " + sParameterName[1]);
            return sParameterName[1];
        }
    }
    return "";
};

function loadConfigMetadata() {
    AjaxPost("/db/LoadConfigMetadata", { configName: currentNamedConfig, user: userId }, function (metadata) {
        if (!metadata.Success) {
            updateHeader(true, false, "Error loading configuration metadata from database");
            return;
        }
        var metadataObj = metadata.data;
        //console.log(metadata);
        
        var displayColumns = [
            {
                text: "Entity Name",
                dataField: "name",
                editable: false
            },
            {
                text: "Collection Name",
                dataField: "collection",
                editable: false
            },
            {
                text: "Version",
                dataField: "version",
                editable: false
            }
        ];
        var dataFields = [
            { name: "name", type: "string", editable: false, display: true },
            { name: "collection", type: "string", editable: false, display: true },
            { name: "file", type: "string", editable: false, display: false },
            { name: "version", type: "string", editable: false, display: true }
        ];
        var source = {
            dataType: "json",
            dataFields: dataFields,
            id: "file",
            hierarchy: {
                root: "values"
            },
            localData: metadataObj.entities
        };
        // ReSharper disable once InconsistentNaming
        var dataAdapter = new $.jqx.dataAdapter(source);
        // create Tree Grid
        $("#configurationEntities").addClass("jqxTreeGrid").jqxTreeGrid(
            {
                width: "100%",
                source: dataAdapter,
                editable: false,
                sortable: true,
                columnsResize: true,
                columns: displayColumns
            });
    });
};

function loadFileMetadata(fileName, id) {
    AjaxPost("/db/LoadFileMetadata", { configName: currentNamedConfig, fileName: fileName, user: userId }, function (metadata) {
        if (!metadata.Success) {
            updateHeader(true, false, "Error loading file metadata from database");
            return;
        }
        var metadataObj = metadata.data;
        //console.log(metadata);
        $(id + " #metadataEntity").val(metadataObj.configurable_entity.name);
        $(id + " #metadataCollection").val(metadataObj.collection);
        $(id + " #metadataVersion").val(metadataObj.version);
        $(id + " #changeLog").val(metadataObj.changelog);
        
        var displayColumns = [
            {
                text: "Name",
                dataField: "name",
                editable: false
            },
            {
                text: "Date Assigned",
                dataField: "assigned",
                editable: false
            }
        ];
        var dataFields = [
            { name: "name", type: "string", editable: false, display: true },
            { name: "assigned", type: "date", editable: false, display: true }
        ];
        var source = {
            dataType: "json",
            dataFields: dataFields,
            id: "name",
            hierarchy: {
                root: "values"
            },
            localData: metadataObj.configurations
        };
        // ReSharper disable once InconsistentNaming
        var dataAdapter = new $.jqx.dataAdapter(source);
        // create Tree Grid
        $(id + " #metadataConfigurations").addClass("jqxTreeGrid").jqxTreeGrid(
            {
                width: "100%",
                source: dataAdapter,
                editable: false,
                sortable: true,
                columnsResize: true,
                columns: displayColumns
            });
    });
};

function loadConfig() {
    console.log("Loading Configuration");
    $("#masterChanges").val("");
    updateHeader(false, false, "");
    var selected = $("#configs").find(":selected");
    if (selected.text() === "No Configurations Found" || selected.text() === "Click \"Load Configurations\" To Load Configuration Names") { return; }
    currentNamedConfig = selected.text();
    $("#configName").val(currentNamedConfig);
    for (var i = 2; i <= lastTabID; i++) {
        $("#tab" + i).remove();
        $("#tablink" + i).remove();
    }
    lastTabID = 1;
    AjaxPost("/db/LoadNamedConfig", { configName: currentNamedConfig, query: selected.val(), user: userId }, function (config) {
        if (!config.Success) {
            updateHeader(true, false, "Error loading configuration files from database");
            return;
        }
        resizeTextAreas();
        for (var file in config.files) {
            if (config.files.hasOwnProperty(file)) {
                var name = config.files[file];
                
                lastTabID++;
                var parentTab = lastTabID;
                $("#tabLinks").append("<li id=\"tablink" + lastTabID + "\" class=\"file-tab\"><a href=\"#tab" + lastTabID + "\">" + name + "</a></li>");
                $("#tabContents").append("<div id=tab" + lastTabID + " class=\"tab\"></div>");
                $("#tab" + lastTabID).html(tableHTML);
                lastTabID++;
                $("#tab" + parentTab + " #tabLinks").first().append("<li id=\"tablink" + lastTabID + "\" class=\"info-tab\"><a href=\"#tab" + lastTabID + "\">File Information</a></li>");
                $("#tab" + parentTab + " #tabContents").first().append("<div id=tab" + lastTabID + " class=\"tab\"></div>");
                $("#tab" + lastTabID).html(infoHTML).trigger("create");
            }
        }
        $("#configLoad").collapsible("option", "disabled", false).collapsible("option", "collapsed", true);
        $("#configSave").collapsible("option", "disabled", false).collapsible("option", "collapsed", false);
        loadConfigMetadata();
        $("#configMetadata").collapsible("option", "disabled", false).collapsible("option", "collapsed", false);
        registerTabFunctions();
    });
};

function loadFile(fileName, parentTab) {
    var selector = $("li", "#tab" + parentTab + " #tabLinks");
    if (selector.length <= 1) {
        console.log("Loading Configuration File");
        AjaxPost("/db/LoadConfigFile", { configName: fileName, user: userId }, function (config) {
            if (!config.Success) {
                updateHeader(true, false, "Error loading configuration file");
                return;
            }
            createTabLevel(config.data, parentTab);
            registerTabFunctions();
        });
    }
};

function baseConfig() {
    AjaxPost("/db/LoadConfigMetadata", { configName: $("#oldConfigName :selected").text(), user: userId }, function (metadata) {
        if (!metadata.Success) {
            updateHeader(true, false, "Error loading configuration metadata from database");
            return;
        }
        var metadataObj = metadata.data;
        
        // Unselect Everything!
        $("#newConfigName").val($("#oldConfigName :selected").text());
        var rows = $("#configurationPicker").jqxTreeGrid("getRows");
        for (var r in rows) {
            if (rows.hasOwnProperty(r)) {
                if (rows[r].checked) {
                    $("#configurationPicker").jqxTreeGrid("uncheckRow", rows[r].uid);
                }
            }
        }
        
        for (var e in metadataObj.entities) {
            if (metadataObj.entities.hasOwnProperty(e)) {
                var entity = metadataObj.entities[e];
                $("#configurationPicker").jqxTreeGrid("updateRow", entity.collection + entity.name, { name: entity.name, version: entity.version });
                $("#configurationPicker").jqxTreeGrid("checkRow", entity.collection + entity.name);
            }
        }

    });
};

function baseExportConfig() {
    AjaxPost("/db/LoadConfigMetadata", { configName: $("#exportConfigName :selected").text(), user: userId }, function (metadata) {
        if (!metadata.Success) {
            updateHeader(true, false, "Error loading configuration metadata from database");
            return;
        }
        exportTarFileName = $("#exportConfigName :selected").text();
        var metadataObj = metadata.data;
        
        // Unselect Everything!
        var rows = $("#filePicker").jqxTreeGrid("getRows");
        for (var r in rows) {
            if (rows.hasOwnProperty(r)) {
                if (rows[r].checked) {
                    $("#filePicker").jqxTreeGrid("uncheckRow", rows[r].uid);
                }
            }
        }
        
        for (var e in metadataObj.entities) {
            if (metadataObj.entities.hasOwnProperty(e)) {
                var entity = metadataObj.entities[e];
                $("#filePicker").jqxTreeGrid("updateRow", entity.collection + entity.name, { name: entity.name, version: entity.version });
                $("#filePicker").jqxTreeGrid("checkRow", entity.collection + entity.name);
            }
        }

    });
};

function saveNewConfig() {
    console.log("Saving New Configuration");
    var rows = $("#configurationPicker").jqxTreeGrid("getCheckedRows");
    var configObj = {
        entities: []
    };
    
    for (var r in rows) {
        if (rows.hasOwnProperty(r) && 
            (typeof rows[r].collection !== "undefined" && rows[r].collection.length > 0) && 
            (typeof rows[r].version !== "undefined" && rows[r].version.length > 0)) {
            configObj.entities.push({ name: rows[r].name, version: rows[r].version, collection: rows[r].collection });
        }
    }
    
    AjaxPost("/db/MakeNewConfig", { user: userId, config: JSON.stringify(configObj), name: $("#newConfigName").val() }, function (retval) {
        if (retval.Success) {
            $("#newConfig").collapsible("option", "collapsed", true);
            getConfigList();
        } else {
            updateHeader(true, false, "MakeNewConfig operation failed.");
        }
    });
};

function exportFiles() {
    console.log("Exporting Files");
    var rows = $("#filePicker").jqxTreeGrid("getCheckedRows");
    var configObj = {
        entities: []
    };
    
    for (var r in rows) {
        if (rows.hasOwnProperty(r) && 
            (typeof rows[r].collection !== "undefined" && rows[r].collection.length > 0) && 
            (typeof rows[r].version !== "undefined" && rows[r].version.length > 0)) {
            configObj.entities.push({ name: rows[r].name, version: rows[r].version, collection: rows[r].collection });
        }
    }
    
    //http://stackoverflow.com/questions/16086162/handle-file-download-from-ajax-post
    var xhr = new XMLHttpRequest();
    xhr.open('POST', "/db/DownloadConfigurationFile", true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function () {
        if (this.status === 200) {
            var filename = "";
            var disposition = xhr.getResponseHeader('Content-Disposition');
            if (disposition && disposition.indexOf('attachment') !== -1) {
                var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                var matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) filename = matches[1].replace(/['"]/g, '');
            }
            var type = xhr.getResponseHeader('Content-Type');
            
            var blob = new Blob([this.response], { type: type });
            if (typeof window.navigator.msSaveBlob !== 'undefined') {
                // IE workaround for "HTML7007: One or more blob URLs were revoked by closing the blob for which they were created. These URLs will no longer resolve as the data backing the URL has been freed."
                window.navigator.msSaveBlob(blob, filename);
            } else {
                var url = window.URL || window.webkitURL;
                var downloadUrl = url.createObjectURL(blob);
                
                if (filename) {
                    // use HTML5 a[download] attribute to specify filename
                    var a = document.createElement("a");
                    // safari doesn't support this yet
                    if (typeof a.download === 'undefined') {
                        window.location = downloadUrl;
                    } else {
                        a.href = downloadUrl;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                    }
                } else {
                    window.location = downloadUrl;
                }
                
                setTimeout(function () { url.revokeObjectURL(downloadUrl); }, 100); // cleanup
            }
        } else if (this.status === 500) {
            updateHeader(true, false, "An error occurred on the server. Contact an expert if the situation persists");
        }
    };
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.send($.param({ user: userId, config: JSON.stringify(configObj), tarFileName: exportTarFileName, type: $("#exportFileFormat :selected").val() }));
    exportTarFileName = "export";
};

function uploadFhiclFile() {
    //http://www.htmlgoodies.com/beyond/javascript/read-text-files-using-the-javascript-filereader.html
    //Retrieve the first (and only!) File from the FileList object
    var f = document.getElementById("fhiclFile").files[0];
    
    if (!f) {
        alert("Failed to load file");
        return;
    }
    
    if ($("#uploadFileFormat :selected").val() === "fhicl" && f.name.search(".fcl") === -1) {
        alert(f.name + " is not a valid fhicl file.");
        return;
    }
    
    if ($("#uploadFileFormat :selected").val() === "json" && f.name.search(".json") === -1) {
        alert(f.name + " is not a valid json file.");
        return;
    }
    
    var r = new FileReader();
    r.onload = function (e) {
        var contents = e.target.result;
        AjaxPost("/db/UploadConfigurationFile", { file: contents, collection: $("#newFileCollection").val(), version: $("#newFileVersion").val(), entity: $("#newFileEntity").val(), user: userId, type: $("#uploadFileFormat :selected").val() }, function (res) {
            if (!res.Success) {
                updateHeader(true, false, "File upload failed");
                return;
            }
            $("#newFileCollection").val("");
            $("#newFileVersion").val("");
            $("#newFileEntity").val("");
            $("#fhiclFile").val("");
            $("#uploadFile").collapsible("option", "collapsed", true);
            $("#exportFile").collapsible("option", "collapsed", true);
            $("#newConfig").collapsible("option", "collapsed", true);
        });
    }
    r.readAsText(f);
};

function setupEntityVersionPicker(tag) {
    AjaxGet("/db/EntitiesAndVersions", function (data) {
        console.log(JSON.stringify(data));
        if (!data.Success) {
            updateHeader(true, false, "Error retrieving entities and versions lists. Please contact an expert!");
            return;
        }
        var collectionsObj = data.collections;
        var dataObj = [];
        var collectionNames = [];
        for (var c in collectionsObj) {
            if (collectionsObj.hasOwnProperty(c)) {
                var collection = [];
                var entitiesObj = collectionsObj[c];
                for (var e in entitiesObj.entities) {
                    if (entitiesObj.entities.hasOwnProperty(e)) {
                        var entity = entitiesObj.entities[e];
                        var versions = [];
                        var search = entity.versions.search;
                        for (var v in search) {
                            if (search.hasOwnProperty(v)) {
                                versions.push({ name: search[v].name });
                            }
                        }
                        collection.push({ id: entitiesObj.name + entity.name, name: entity.name, collection: entity.collection, edited: false, version: versions[0].name, versions: versions });
                    }
                }
                dataObj.push({ id: entitiesObj.name, name: entitiesObj.name, entities: collection });
                collectionNames.push(entitiesObj.name);
            }
        }
        
        var displayColumns = [
            {
                text: "Entity Name",
                dataField: "name",
                editable: false,
                cellClassName: cellClass
            },
            {
                text: "Version",
                dataField: "version",
                editable: true,
                columntype: 'template',
                initEditor: function (row, cellvalue, editor) {
                    var index1 = -1;
                    var index2 = -1;
                    for (var r in dataObj) {
                        if (dataObj.hasOwnProperty(r)) {
                            if (row.indexOf(dataObj[r].name) === 0) {
                                index1 = r;
                            }
                        }
                    }
                    if (index1 >= 0) {
                        var localData = dataObj[index1];
                        for (var rr in localData.entities) {
                            if (localData.entities.hasOwnProperty(rr)) {
                                if (row === localData.entities[rr].uid) {
                                    index2 = rr;
                                }
                            }
                        }
                        if (index2 >= 0) {
                            var versionsSource = { datatype: "array", datafields: [{ name: "name", type: "string" }], localdata: dataObj[index1].entities[index2].versions };
                            // ReSharper disable once InconsistentNaming
                            var versionsAdapter = new $.jqx.dataAdapter(versionsSource, { autoBind: true });
                            editor.jqxDropDownList({ source: versionsAdapter, displayMember: 'name', valueMember: 'name', selectedIndex: 0 }).jqxDropDownList("refresh");
                        }
                    }
                    // set the editor's current value. The callback is called each time the editor is displayed.
                    editor.jqxDropDownList('selectItem', cellvalue);
                },
                getEditorValue: function (row, cellvalue, editor) {
                    // return the editor's value.
                    return editor.val();
                },
                cellClassName: cellClass
            }
        ];
        
        var dataFields = [
            { name: "id", type: "string", editable: false, display: false },
            { name: "name", type: "string", editable: false, display: true },
            { name: "version", type: "string", editable: true, display: true },
            { name: "versions", type: "array", editable: false, display: false },
            { name: "edited", type: "boolean", editable: false, display: false },
            { name: "entities", type: "array", editable: false, display: false }
        ];
        var source = {
            dataType: "json",
            dataFields: dataFields,
            id: "id",
            hierarchy: {
                root: "entities"
            },
            localData: dataObj
        };
        // ReSharper disable once InconsistentNaming
        var dataAdapter = new $.jqx.dataAdapter(source);
        // create Tree Grid
        tag.addClass("jqxTreeGrid").jqxTreeGrid({
            width: "100%",
            source: dataAdapter,
            sortable: true,
            editable: true,
            columnsResize: true,
            checkboxes: true,
            hierarchicalCheckboxes: true,
            columns: displayColumns
        });
        for (var n in collectionNames) {
            if (collectionNames.hasOwnProperty(n)) {
                tag.jqxTreeGrid("lockRow", collectionNames[n]);
            }
        }
    });
}

function saveConfig() {
    console.log("Saving Configuration Changes");
    var files = [];
    $(".file-tab.editedValue").each(function () {
        var log = $("#changes", $(this).attr("href")).val();
        var collectionS = $("#metadataCollection", $(this).attr("href"));
        var collection = collectionS.val();
        files.push({ name: $(this).text(), changelog: log, collection: collection });
    });
    AjaxPost("/db/saveConfig", {
        oldConfigName: currentNamedConfig,
        newConfigName: $("#configName").val(),
        files: files,
        user: userId
    }, function (res) {
        if (res !== null && res !== undefined && res.Success) {
            updateHeader(false, false, "Configuration Saved.");
            getConfigList();
        } else {
            updateHeader(true, false, "Failed to save configuration!");
        }
    });
};

function discardConfig() {
    console.log("Discarding Configuration Changes");
    var files = [];
    $(".file-tab.editedValue").each(function () {
        files.push({ name: $(this).text() });
    });
    AjaxPost("/db/discardConfig", { configName: currentNamedConfig , files: files, user: userId }, function (res) {
        if (res.Success) {
            getConfigList();
        } else {
            updateHeader(true, false, "Failed to discard configuration. Make sure you have a valid configuration selected.\nIf this problem persists, call an expert.");
        }
    });
};

(function ($, sr) {
    
    // debouncing function from John Hann
    // http://unscriptable.com/index.php/2009/03/20/debouncing-javascript-methods/
    var debounce = function (func, threshold, execAsap) {
        var timeout;
        
        return function debounced() {
            var obj = this, args = arguments;
            function delayed() {
                if (!execAsap)
                    func.apply(obj, args);
                timeout = null;
            }            ;
            
            if (timeout)
                clearTimeout(timeout);
            else if (execAsap)
                func.apply(obj, args);
            
            timeout = setTimeout(delayed, threshold || 100);
        };
    }
    // smartresize 
    // ReSharper disable once UseOfImplicitGlobalInFunctionScope
    jQuery.fn[sr] = function (fn) { return fn ? this.bind('resize', debounce(fn)) : this.trigger(sr); };

})(jQuery, 'smartresize');

$(document).ready(function () {
    defaultColor = $("#header").css("background-color");
    defaultShadow = $("#header").css("text-shadow");
    
    $.get("/db/Tables.html", function (data) {
        tableHTML = data;
    });
    
    $.get("/db/FileInfo.html", function (data) {
        infoHTML = data;
    });

    $.get("/db/TreeGrid.html", function(data) {
        treeGridHTML = data;
    });
    
    $(".configInfo-tab").on("click", function () {
        resizeTextAreas();
    });
    
    registerTabFunctions();
    $(".tabs #tab1").show().siblings().hide();
    
    $(".triggersModified").change(function () {
        updateHeader(false, true, "There are pending unsaved changes. Please save or discard before closing the editor!");
    });
    
    $(window).smartresize(function () {
        $(".jqxTreeGrid").jqxTreeGrid({ width: "100%" }).jqxTreeGrid('refresh');
    });
    
    $("#newConfig").on("collapsibleexpand", function () {
        setupEntityVersionPicker($("#configurationPicker"));
    });
    
    $("#exportFile").on("collapsibleexpand", function () {
        setupEntityVersionPicker($("#filePicker"));
    });
});