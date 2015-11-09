var testData;
var defaultColor = "";
var defaultShadow = "";
var tableHTML;
var radixButtonHTML;
var currentNamedConfig;
var currentTable;

function getUrlParameter(sParam) {
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0].search(sParam) > 0) {
            return sParameterName[1];
        }
    }
}

var makeTreeGrid = function (tag, displayColumns, dataFields, data, key, parent) {
    // prepare the data
    var source = {
        dataType: "json",
        dataFields: dataFields,
        hierarchy: {
            keyDataField: { name: key },
            parentDataField: { name: parent }
        },
        id: key,
        localData: data
    };
    var dataAdapter = new $.jqx.dataAdapter(source, {
        beforeLoadComplete: function (records) {
            var numberFields = [];
            for (var c in source.dataFields) {
                if (source.dataFields[c].dataType === "number" && source.dataFields[c].name !== key && source.dataFields[c].name !== parent) {
                    numberFields.push({ name: source.dataFields[c].name, radix: source.dataFields[c].radix });
                }
            }
            for (var i in records) {
                for (var f in numberFields) {
                    var radix = numberFields[f].radix;
                    if (!radix) { radix = 10; }
                    var value = records[i][numberFields[f].name];
                    if (value) {
                        if (typeof value === "number" || !(value.search("0x") == 0 || value.search("0") == 0 || value.search("b") == value.length - 1)) {
                            
                            value = parseInt(value).toString(radix).toUpperCase();
                            records[i][numberFields[f].name] = value;
                            if (radix == 2) { records[i][numberFields[f].name] += 'b'; }
                            if (radix == 16) { records[i][numberFields[f].name] = "0x" + value; }
                            if (radix == 8) { records[i][numberFields[f].name] = "0" + value; }
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
            columns: displayColumns
        });
    // Cell End Edit
    tag.on('cellEndEdit', function (event) {
        var args = event.args;
        // row key
        var rowKey = args.key;
        // row's data.
        var rowData = args.row;
        // column's data field.
        var columnDataField = args.dataField;
        // column's display field.
        var columnDisplayField = args.displayField;
        // cell's value.
        var value = args.value;
        $.post("/db/Update", { config: currentNamedConfig, table: currentTable, row: rowKey, column: columnDataField, value: value })
        $("#debug").html("<br/>cellEndEdit - Row ID: " + rowKey + ", Column: " + columnDataField + ", Value: " + value + "<br/>" + $("#debug").html());
        
    });
}

var loadTable = function () {
    AjaxPost('/db/GetData', { config: currentNamedConfig, category: currentTable.category, table: currentTable.table }, function (data) {
        var dataObj = JSON.parse(data);
        var columns = dataObj.columns;
        var displayColumns = [];
        
        for (var c in columns) {
            if (columns[c].name !== dataObj.key && columns[c].name !== dataObj.parent) {
                var title = columns[c].name.charAt(0).toUpperCase() + columns[c].name.slice(1);
                if (columns[c].type === "string") {
                    displayColumns.push({ text: title, dataField: columns[c].name, editable: false });
                }
                else {
                    columns[c].type = "string";
                    columns[c].dataType = "number";
                    displayColumns.push({
                        text: title, dataField: columns[c].name,
                        createEditor: function (row, cellvalue, editor, cellText, width, height) {
                            editor.after("<div></div>");
                            var radix = 10;
                            if (typeof cellText === "string" && cellText.search("0x") == 0) {
                                cellText = cellText.slice(2);
                                cellvalue = cellvalue.slice(2);
                                radix = 16;
                            }
                            else if (typeof cellText === "string" && cellText.search("0") == 0) {
                                cellText = cellText.slice(1);
                                cellvalue = cellvalue.slice(1);
                                radix = 8;
                            }
                            else if (typeof cellText === "string" && cellText.search("b") >= 0) {
                                cellText = cellText.slice(0, -1);
                                cellvalue = cellvalue.slice(0, -1);
                                radix = 2;
                            }
                            editor.parent().jqxFormattedInput({ radix: radix, value: cellvalue, width: width, height: height, upperCase: true, dropDown: true, spinButtons: false });
                        },
                        initEditor: function (row, cellvalue, editor, celltext, width, height) {
                            editor.parent().val(cellvalue);
                        },
                        getEditorValue: function (row, cellvalue, editor) {
                            var radix = editor.parent().jqxFormattedInput('radix');
                            if (radix == 2 || radix === "binary") { return editor.parent().jqxFormattedInput('val', 'binary') + 'b'; }
                            if (radix == 16 || radix === "hexadecimal") { return "0x" + editor.parent().jqxFormattedInput('val', 'hexadecimal').toUpperCase(); }
                            if (radix == 8 || radix === "octal") { return "0" + editor.parent().jqxFormattedInput('val', 'octal'); }
                            
                            return editor.parent().val();
                        }
                    });
                }
            }
        }
        
        var tag = $('.tabs #tab' + (currentTable.category + 2) + ' #tabletab' + (currentTable.table + 1));
        makeTreeGrid(tag, displayColumns, columns, dataObj.data, dataObj.key, dataObj.parent);//.trigger('create');

    });
}

var loadConfigs = function () {
    AjaxGet("/db/NamedConfigs", function (data) {
        $("#configs").html(data.join("")).trigger('create').selectmenu('refresh');
        var config = getUrlParameter("configs");
        if (config !== undefined) {
            $("#configs").val(config);
        }
    });
}

var updateHeader = function (error, text) {
    if (error) {
        $("#header").css("background-color", "red").css("text-shadow", "#E55 0px 1px 0px");
        $("#info").text(text);
    } else {
        $("#header").css("background-color", defaultColor).css("text-shadow", defaultShadow);
        $("#info").text(text);
    }
}

var registerTabFunctions = function () {
    $('.tabs .table-data a').off();
    $('.tabs .tab-links a').off().on('click', function (e) {
        var currentAttrValue = $(this).attr('href');
        
        // Show/Hide Tabs
        $('.tabs ' + currentAttrValue).show().siblings().hide();
        
        // Change/remove current tab to active
        $(this).parent('li').addClass('active').siblings().removeClass('active');
        
        e.preventDefault();
    });
    $('.table-data a').on('click', function (e) {
        var currentAttrValue = $(this).attr('href');
        var matches = currentAttrValue.match(/#tab(\d+) #tabletab(\d+)/);
        currentTable = { category: parseInt(matches[1]) - 2, table: parseInt(matches[2]) - 1 };
        loadTable();
    });
}

$(document).ready(function () {
    defaultColor = $("#header").css("background-color");
    defaultShadow = $("#header").css("text-shadow");
    
    $.get("/db/Tables.html", function (data) {
        tableHTML = data;
    });
    
    registerTabFunctions();
    $('.tabs #tab1').show().siblings().hide();
    
    $("#loadConfigButton").click(function () {
        configNeedsRestart = false;
        updateHeader(false, "");
        currentNamedConfig = $("#configs").find(':selected').val();
        AjaxPost("/db/LoadNamedConfig", { configFile: currentNamedConfig }, function (config) {
            var configObj = JSON.parse(config);
            for (var category in configObj) {
                var catNum = parseInt(category) + 2;
                $("#tabLinks").append("<li><a href=\"#tab" + catNum + "\">" + configObj[category].name + "</a></li>");
                $("#tabContents").append("<div id=tab" + catNum + " class=\"tab\"></div>");
                $("#tab" + catNum).html(tableHTML);
                var tableObj = configObj[category].tables;
                for (var table in tableObj) {
                    var tabNum = parseInt(table) + 1;
                    $("#tab" + catNum + " #tabletabLinks").append("<li><a href=\"#tab" + catNum + " #tabletab" + tabNum + "\">" + tableObj[table] + "</a></li>");
                    $("#tab" + catNum + " #tabletabContents").append("<div id=tabletab" + tabNum + " class=\"tab\"></div>");
                    registerTabFunctions();
                }
                registerTabFunctions();
            }
        });
    });
    loadConfigs();
    
    $("#saveConfig").click(function () {
        var config = saveConfiguration();
        AjaxPost("/db/saveConfig", { config: JSON.stringify(config) }, function (res) {
            if (res !== null && res.Success) {
                updateHeader(false, "Configuration Saved.");
            } else {
                updateHeader(true, "Failed to save configuration!");
            }
            
            loadConfigs();
        });
    });
});