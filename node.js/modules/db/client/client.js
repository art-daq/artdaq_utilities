var testData;
var defaultColor = "";
var defaultShadow = "";
var tableHTML;
var radixButtonHTML;
var currentNamedConfig = { name: "", path: "" };
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
    if (isNaN(cellText) || cellText.length === 0 || cellText.indexOf(".") >= 0) {
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
        beforeLoadComplete: function(records) {
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
        width: 850,
        source: dataAdapter,
        editable: true,
        editSettings: { saveOnPageChange: true, saveOnBlur: true, saveOnSelectionChange: true, cancelOnEsc: true, saveOnEnter: true, editSingleCell: true, editOnDoubleClick: true, editOnF2: true },
        sortable: true,
        columnsResize: true,
        columns: displayColumns,
        rendered: function() {
            $(".jqx-tooltip").remove();
            var setupRow = function(rowObject) {
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
    tag.on("cellEndEdit", function(event) {
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
            baseDir: $("#baseDir").val(),
            configInfo: {
                name: currentNamedConfig.name,
                path: currentNamedConfig.path
            },
            table: currentTable,
            column: columnDataField,
            id: rowData.id,
            name: rowData.name,
            value: value
        });
        var now = new Date;
        $("#changes").val(now.toISOString() + ": Edit - Table: " + currentTable + ", Name: " + rowData.name + ", Column: " + columnName + ", Value: " + value + "\n" + $("#changes").val());
        resizeTextAreas();
        updateHeader(true, "There are pending unsaved changes. Please save or discard before closing the editor!");
    });
}

function loadTable(path, tag) {
    currentTable = path;
    AjaxPost("/db/GetData", { baseDir: $("#baseDir").val(), configInfo: { name: currentNamedConfig.name, path: currentNamedConfig.path }, path: path }, function(data) {
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

        makeTreeGrid(tag, displayColumns, columns, dataObj.data, dataObj.comment); //.trigger('create');

    });
};

function loadConfigs() {
    updateHeader(false, "");
    $("#changes").val("");
    $("#changeLog").val("");
    resizeTextAreas();
    for (var i = 2; i <= lastTabID; i++) {
        $("#tab" + i).remove();
        $("#tablink" + i).remove();
    }
    AjaxPost("/db/NamedConfigs", { data: $("#baseDir").val() }, function(data) {
        $("#configs").html(data.join("")).trigger("create").selectmenu("refresh");
        var config = getUrlParameter("configs");
        if (config !== undefined) {
            $("#configs").val(config);
        }
    });
};

function registerTabFunctions() {
    $(".tabs .table-data a").off();
    $(".tabs .tab-links a").off().on("click", function(e) {
        var currentAttrValue = $(this).attr("href");

        // Show/Hide Tabs
        $(".tabs " + currentAttrValue).show().siblings().hide();

        // Change/remove current tab to active
        $(this).parent("li").addClass("active").siblings().removeClass("active");

        e.preventDefault();
    });
    $(".table-data a").on("click", function(e) {
        var path = [];
        $("li.active :visible").each(function(index, item) {
            path.push(item.firstChild.textContent);
        });
        console.log(path.join("/"));
        loadTable(path.join("/"), $(".tabs " + $(this).attr("href")));
    });
};

function createTabLevel(structureObj, parentTab) {
    var categoryObj = structureObj.children;
    for (var cat in categoryObj) {
        lastTabID++;
        $("#tab" + parentTab + " #tabLinks").first().append("<li id=\"tablink" + lastTabID + "\"><a href=\"#tab" + lastTabID + "\">" + categoryObj[cat].name + "</a></li>");
        $("#tab" + parentTab + " #tabContents").first().append("<div id=tab" + lastTabID + " class=\"tab\"></div>");
        $("#tab" + lastTabID).html(tableHTML);
        createTabLevel(categoryObj[cat], lastTabID);
    }
    var tableObj = structureObj.tables;
    for (var table in tableObj) {
        lastTabID++;
        var name = tableObj[table].name;
        if (name.length === 0) {
            name = tableObj[table];
        }
        $("#tab" + parentTab + " #tabLinks").first().append("<li id=\"tablink" + lastTabID + "\" class=\"table-data\"><a href=\"#tab" + lastTabID + "\">" + name + "</a></li>");
        $("#tab" + parentTab + " #tabContents").first().append("<div id=tab" + lastTabID + " class=\"tab\"></div>");
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
}

function checkDirAndLoadConfigNames() {
    $.post("/db/SetBaseDirectory", { data: $("#baseDir").val() }, function (data) {
        if (data) {
            loadConfigs();
            $("#configLoad").collapsible("option", "disabled", false).collapsible("option", "collapsed", false);
            $("#configSave").collapsible("option", "disabled", true).collapsible("option", "collapsed", true);
            $("#configMetadata").collapsible("option", "disabled", true).collapsible("option", "collapsed", true);
        } else {
            $("#configLoad").collapsible("option", "disabled", true).collapsible("option", "collapsed", true);
            $("#configSave").collapsible("option", "disabled", true).collapsible("option", "collapsed", true);
            $("#configMetadata").collapsible("option", "disabled", true).collapsible("option", "collapsed", true);
        }
    });
}

$(document).ready(function() {
    defaultColor = $("#header").css("background-color");
    defaultShadow = $("#header").css("text-shadow");

    $.get("/db/Tables.html", function(data) {
        tableHTML = data;
    });

    registerTabFunctions();
    $(".tabs #tab1").show().siblings().hide();

    $("#baseDir").keyup(function() {
        checkDirAndLoadConfigNames();
    });

    var configPathParameter = "" + getUrlParameter("configPath");
    var baseDirParameter = "" + getUrlParameter("baseDir");
    var givenParameter = configPathParameter.length > baseDirParameter.length ? configPathParameter : baseDirParameter;
    if (givenParameter.length > 0 && givenParameter !== "undefined") {
        $("#baseDir").val(givenParameter);
        checkDirAndLoadConfigNames();
    }

    $("#reloadConfigsButton").click(function() {
        checkDirAndLoadConfigNames();
    });

    $("#loadConfigButton").click(function() {
        updateHeader(false, "");
        var selected = $("#configs").find(":selected");
        currentNamedConfig = { name: selected.text(), path: selected.val() };
        $("#configPath").val(currentNamedConfig.path);
        $("#configName").val(currentNamedConfig.name);
        for (var i = 2; i <= lastTabID; i++) {
            $("#tab" + i).remove();
            $("#tablink" + i).remove();
        }
        lastTabID = 1;
        AjaxPost("/db/LoadNamedConfig", { configInfo: { name: currentNamedConfig.name, path: currentNamedConfig.path }, baseDir: $("#baseDir").val() }, function(config) {
            var configObj = JSON.parse(config);
            $("#changeLog").val(configObj.metadata.changeLog)
            resizeTextAreas();
            for (var category in configObj.children) {
                if (configObj.children.hasOwnProperty(category)) {
                    lastTabID++;
                    $("#tabLinks").append("<li id=\"tablink" + lastTabID + "\"><a href=\"#tab" + lastTabID + "\">" + configObj.children[category].name + "</a></li>");
                    $("#tabContents").append("<div id=tab" + lastTabID + " class=\"tab\"></div>");
                    $("#tab" + lastTabID).html(tableHTML);
                    createTabLevel(configObj.children[category], lastTabID);
                }
            }
            for (var table in configObj.tables) {
                if (configObj.tables.hasOwnProperty(table)) {
                    lastTabID++;
                    $("#tabLinks").append("<li id=\"tablink" + lastTabID + "\" class=\"table-data\"><a href=\"#tab" + lastTabID + "\">" + configObj.tables[table] + "</a></li>");
                    $("#tabContents").append("<div id=tab" + lastTabID + " class=\"tab\"></div>");
                }
            }
            $("#configMetadataText").val("");
            for (var md in configObj.metadata) {
                if (configObj.metadata.hasOwnProperty(md)) {
                    if (md !== "changeLog" && md !== "name") {
                        $("#configMetadataText").val($("#configMetadataText").val() + md + ": " + JSON.stringify(configObj.metadata[md]) + "\n");
                    }
                }
            }
            $("#configLoad").collapsible("option", "disabled", false).collapsible("option", "collapsed", true);
            $("#configSave").collapsible("option", "disabled", false).collapsible("option", "collapsed", false);
            $("#configMetadata").collapsible("option", "disabled", false).collapsible("option", "collapsed", false);
            registerTabFunctions();
        });
    });

    $("#saveConfig").click(function() {
        AjaxPost("/db/saveConfig", {
            baseDir: $("#baseDir").val(),
            oldConfigInfo: { name: currentNamedConfig.name, path: currentNamedConfig.path },
            newConfigInfo: {
                name: $("#configName").val(),
                path: $("#configPath").val()
            },
            log: $("#changes").val()
        }, function(res) {
            if (res !== null && res.Success) {
                updateHeader(false, "Configuration Saved.");
            } else {
                updateHeader(true, "Failed to save configuration!");
            }
            checkDirAndLoadConfigNames();
        });
    });

    $("#discardConfig").click(function() {
        AjaxPost("/db/discardConfig", { baseDir: $("#baseDir").val(), configInfo: { name: currentNamedConfig.name, path: currentNamedConfig.path } }, function(res) {
            if (res) {
                $("#changes").val("").height($("#changes").scrollHeight);
                loadConfigs();
            } else {
                updateHeader(true, "Failed to discard configuration. Make sure you have a valid configuration selected.\nIf this problem persists, call an expert.");
            }
        });
    });

    $(".triggersModified").change(function() {
        updateHeader(true, "There are pending unsaved changes. Please save or discard before closing the editor!");
    });
});