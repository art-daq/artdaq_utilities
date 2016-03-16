﻿var testData;
var defaultColor = "";
var defaultShadow = "";
var tableHTML;
var radixButtonHTML;
var currentNamedConfig = "";
var currentMetadata;
var currentTable;
var lastTabID = 1;

function updateHeader(error, text) {
    if (error) {
        $("#header").css("background-color", "#D59595").css("text-shadow", "#D99 0px 1px 0px");
        $("#info").text(text);
    } else {
        $("#header").css("background-color", defaultColor).css("text-shadow", defaultShadow);
        $("#info").text(text);
    }
};

function resizeTextAreas() {
    $("textarea").each(function (i, el) {
        $(el).height(el.scrollHeight);
    });
}

function createRowEditor(row, cellvalue, editor, cellText, width, height) {
    editor.after("<div></div><div></div>");
    var radix = 10;
    if (typeof cellText === "string" && cellText.search("0x") == 0) {
        cellText = cellText.slice(2);
        cellvalue = cellvalue.slice(2);
        radix = 16;
    } else if (typeof cellText === "string" && cellText.search("0") == 0) {
        cellText = cellText.slice(1);
        cellvalue = cellvalue.slice(1);
        radix = 8;
    } else if (typeof cellText === "string" && cellText.search("b") >= 0) {
        cellText = cellText.slice(0, -1);
        cellvalue = cellvalue.slice(0, -1);
        radix = 2;
    }
    if (isNaN(cellText) || ("" + cellText).length === 0 || ("" + cellText).indexOf(".") >= 0) {
        return;
    }
    editor.parent().jqxFormattedInput({ radix: radix, value: cellvalue, width: width, height: height, upperCase: true, dropDown: true, spinButtons: true });
}

function initRowEditor(row, cellvalue, editor, celltext, width, height) {
    editor.parent().val(cellvalue);
}

function getRowEditorValue(row, cellvalue, editor) {
    if (editor.parent()) {
        if (editor.val().search("000") === 0 || editor.val().length === 0) {
            editor.parent().parent().empty();
            return "";
        }
        var radix = editor.parent().jqxFormattedInput("radix");
        if (radix == 2 || radix === "binary") {
            return editor.val() + "b";
        }
        if (radix == 16 || radix === "hexadecimal") {
            return "0x" + editor.val().toUpperCase();
        }
        if (radix == 8 || radix === "octal") {
            return "0" + editor.val();
        }
        if (editor.val().search("000") === 0) {
            editor.parent().parent().empty();
            return "";
        }
    }
    return editor.val();
}

function makeTreeGrid(tag, displayColumns, dataFields, data, comment) {
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
        comment: comment
    };
    var dataAdapter = new $.jqx.dataAdapter(source, {
        beforeLoadComplete: function (records) {
            var numberFields = [];
            for (var c in source.dataFields) {
                if (source.dataFields[c].dataType === "number") {
                    numberFields.push({ name: source.dataFields[c].name, radix: source.dataFields[c].radix });
                }
            }
            for (var i in records) {
                for (var f in numberFields) {
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
            return records;
        }
    });
    // create Tree Grid
    tag.jqxTreeGrid(
        {
            width: "100%",
            source: dataAdapter,
            editable: true,
            editSettings: { saveOnPageChange: true, saveOnBlur: true, saveOnSelectionChange: true, cancelOnEsc: true, saveOnEnter: true, editSingleCell: true, editOnDoubleClick: true, editOnF2: true },
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
                        setupRow(rowObject.records[trow]);
                    }
                };
                var rows = tag.jqxTreeGrid("getRows");
                for (var ttrow = 0; ttrow < rows.length; ttrow++) {
                    setupRow(rows[ttrow]);
                }
            }
        });
    // Cell End Edit
    tag.on("cellEndEdit", function (event) {
        var args = event.args;
        // row key
        var rowKey = args.key;
        // row's data.
        var rowData = args.row;
        var columnDataField = args.dataField;
        // column name
        var columnName = args.dataField;
        for (var i in args.owner._columns) {
            if (args.owner._columns[i].dataField === columnName) {
                columnName = args.owner._columns[i].text;
                break;
            }
        }
        // cell's value.
        var value = args.value;
        AjaxPost("/db/Update", {
            configName: currentNamedConfig,
            table: currentTable,
            column: columnDataField,
            id: rowData.id,
            name: rowData.name,
            value: value
        }, function (retval) { });
        var now = new Date;
        $("#changes").val(now.toISOString() + ": Edit - Table: " + currentTable + ", Name: " + rowData.name + ", Column: " + columnName + ", Value: " + value + "\n" + $("#changes").val());
        resizeTextAreas();
        updateHeader(true, "There are pending unsaved changes. Please save or discard before closing the editor!");
    });
}

function loadTable(path, tag) {
    currentTable = path;
    AjaxPost("/db/GetData", { configName: currentNamedConfig, path: path }, function (data) {
        var dataObj = JSON.parse(data);
        var columns = dataObj.columns;
        var displayColumns = [];
        
        for (var c in columns) {
            var title = columns[c].title;
            if (typeof title === "undefined" || title.length === 0) {
                title = columns[c].name.charAt(0).toUpperCase() + columns[c].name.slice(1);
            }
            if (columns[c].type === "string" && columns[c].display) {
                displayColumns.push({
                    text: title,
                    dataField: columns[c].name,
                    editable: columns[c].editable,
                    createEditor: createRowEditor,
                    initEditor: initRowEditor,
                    getEditorValue: getRowEditorValue
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
                    getEditorValue: getRowEditorValue
                });
            }
        }
        
        makeTreeGrid(tag, displayColumns, columns, dataObj.data.children, dataObj.comment); //.trigger('create');

    });
};

function getConfigList() {
    updateHeader(false, "");
    $("#changes").val("");
    $("#changeLog").val("");
    resizeTextAreas();
    for (var i = 2; i <= lastTabID; i++) {
        $("#tab" + i).remove();
        $("#tablink" + i).remove();
    }
    AjaxGet("/db/NamedConfigs", function (data) {
        $("#configs").html(data.join("")).trigger("create").selectmenu("refresh");
        var config = getUrlParameter("configs");
        if (config !== undefined) {
            $("#configs").val(config);
        }
    });
    $("#configLoad").collapsible("option", "disabled", false).collapsible("option", "collapsed", false);
    $("#configSave").collapsible("option", "disabled", true).collapsible("option", "collapsed", true);
    $("#configMetadata").collapsible("option", "disabled", true).collapsible("option", "collapsed", true);
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
    $(".table-data a").on("click", function (e) {
        var path = [];
        $("li.active :visible").each(function (index, item) {
            path.push(item.firstChild.textContent);
        });
        console.log(path.join("/"));
        loadTable(path.join("/"), $(".tabs " + $(this).attr("href")));
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
    AjaxPost("/db/LoadConfigMetadata", { configName: currentNamedConfig }, function (metadata) {
        var metadataObj = JSON.parse(metadata);
        //console.log(metadata);
        $("#metadataEntity").val(metadataObj.configurable_entity.name);
        $("#metadataVersion").val(metadataObj.version);
        
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
        var dataAdapter = new $.jqx.dataAdapter(source);
        // create Tree Grid
        $("#metadataConfigurations").jqxTreeGrid(
            {
                width: "100%",
                source: dataAdapter,
                editable: false,
                sortable: true,
                columnsResize: true,
                columns: displayColumns
            });
        
        $("#configMetadata").collapsible("option", "disabled", false).collapsible("option", "collapsed", false);
    });
}

function loadConfig() {
    console.log("Loading Configuration");
    updateHeader(false, "");
    var selected = $("#configs").find(":selected");
    currentNamedConfig = selected.text();
    $("#configName").val(currentNamedConfig);
    for (var i = 2; i <= lastTabID; i++) {
        $("#tab" + i).remove();
        $("#tablink" + i).remove();
    }
    lastTabID = 1;
    AjaxPost("/db/LoadNamedConfig", { configName: currentNamedConfig }, function (config) {
        var configObj = JSON.parse(config);
        //$("#changeLog").val(configObj.metadata.changeLog);
        resizeTextAreas();
        for (var category in configObj.children) {
            if (configObj.children.hasOwnProperty(category)) {
                var name = configObj.children[category].name;
                if (name.length === 0) { name = configObj.children[category]; }
                if (configObj.children[category].hasSubtables) {
                    //console.log("Category: " + JSON.stringify(configObj.children[category]));
                    lastTabID++;
                    $("#tabLinks").append("<li id=\"tablink" + lastTabID + "\"><a href=\"#tab" + lastTabID + "\">" + name + "</a></li>");
                    $("#tabContents").append("<div id=tab" + lastTabID + " class=\"tab\"></div>");
                    $("#tab" + lastTabID).html(tableHTML);
                    createTabLevel(configObj.children[category], lastTabID);
                } else {
                    lastTabID++;
                    $("#tabLinks").append("<li id=\"tablink" + lastTabID + "\" class=\"table-data\"><a href=\"#tab" + lastTabID + "\">" + name + "</a></li>");
                    $("#tabContents").append("<div id=tab" + lastTabID + " class=\"tab\"></div>");
                }
            }
        }
        $("#configLoad").collapsible("option", "disabled", false).collapsible("option", "collapsed", true);
        $("#configSave").collapsible("option", "disabled", false).collapsible("option", "collapsed", false);
        registerTabFunctions();
    loadConfigMetadata();
    });
};

function saveConfig() {
    console.log("Saving Configuration Changes");
    AjaxPost("/db/saveConfig", {
        oldConfigName: currentNamedConfig,
        newConfigName: $("#configName").val(),
        log: $("#changes").val()
    }, function (res) {
        if (res !== null && res.Success) {
            updateHeader(false, "Configuration Saved.");
        } else {
            updateHeader(true, "Failed to save configuration!");
        }
        getConfigList();
    });
};

function discardConfig() {
    console.log("Discarding Configuration Changes");
    AjaxPost("/db/discardConfig", { configName: currentNamedConfig }, function (res) {
        if (res) {
            $("#changes").val("").height($("#changes").scrollHeight);
            getConfigList();
        } else {
            updateHeader(true, "Failed to discard configuration. Make sure you have a valid configuration selected.\nIf this problem persists, call an expert.");
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
    jQuery.fn[sr] = function (fn) { return fn ? this.bind('resize', debounce(fn)) : this.trigger(sr); };

})(jQuery, 'smartresize');

$(document).ready(function () {
    defaultColor = $("#header").css("background-color");
    defaultShadow = $("#header").css("text-shadow");
    
    $.get("/db/Tables.html", function (data) {
        tableHTML = data;
    });
    
    registerTabFunctions();
    $(".tabs #tab1").show().siblings().hide();
    
    getConfigList();
    
    $(".triggersModified").change(function () {
        updateHeader(true, "There are pending unsaved changes. Please save or discard before closing the editor!");
    });
    
    
    $(window).smartresize(function () {
        $(".jqx-grid").jqxTreeGrid({ width: "100%" });
    });
});