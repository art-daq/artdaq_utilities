var testData;
var defaultColor = "";
var defaultShadow = "";
var tableHTML;
var currentNamedConfig;

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

var setupNodes = function (level, paths, columnns, maxlevel) {
    var output = "";
    if (level == 0) {
        output = "<ul data-role=\"listview\" class=\"ui-listview-outer\" data-inset=\"true\">";
    } else {
        output = "<ul data-role=\"listview\" data-shadow=\"false\" data-inset=\"true\" data-corners=\"false\">";
    }
    
    var nodes = [];
    for (var pathN in paths) {
        var path = paths[pathN];
        if (path.length > level) {
            if (nodes.indexOf(path[level]) == -1) {
                nodes.push(path[level]);
                if (level < maxlevel) {
                    output += "<li data-role=\"collapsible\" data-iconpos=\"right\" data-shadow=\"false\" data-corners=\"false\">";
                    output += "<h2>" + path[level] + "</h2>";
                }
                else {
                    output += "<li>" + path[level];
                }
                output += setupNodes(level + 1, paths, columns, maxlevel);
                output += "</li>";
            }
        }
    }
    
    return output + "</ul>";
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
        AjaxPost('/db/GetData', { config: currentNamedConfig, category: parseInt(matches[1]) - 2, table: parseInt(matches[2]) - 1 }, function (data) {
            var dataObj = JSON.parse(data);
            var columns = [];
            var paths = [];
            var maxlevel = 0;
            for (var itemN in dataObj) {
                var item = dataObj[itemN];
                for (var prop in item) {
                    if (item.hasOwnProperty(prop)) {
                        if (prop !== "name" && columns.indexOf(prop) == -1) {
                            columns.push(prop);
                        }
                    }
                }
                
                var path = item.name.split('/');
                if (path.length > maxlevel) { maxlevel = path.length; }
                paths.push(path);
            }
            var list = setupNodes(0, paths, columns, maxlevel - 1);
            $('.tabs ' + currentAttrValue).html(list).trigger('create');
        });
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