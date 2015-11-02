var testData;
var defaultColor = "";
var defaultShadow = "";

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

$(document).ready(function () {
    defaultColor = $("#header").css("background-color");
    defaultShadow = $("#header").css("text-shadow");
    $('.tabs .tab-links a').on('click', function (e) {
        var currentAttrValue = $(this).attr('href');
        
        // Show/Hide Tabs
        $('.tabs ' + currentAttrValue).show().siblings().hide();
        
        // Change/remove current tab to active
        $(this).parent('li').addClass('active').siblings().removeClass('active');
        
        e.preventDefault();
    });
    
    $('.tabs #tab1').show().siblings().hide();
    
    $("#loadConfigButton").click(function () {
        configNeedsRestart = false;
        updateHeader(false, "");
        var selected = $("#configs").find(':selected').val();
        AjaxPost("/db/LoadNamedConfig", { configFile: selected }, function (config) {
            $("#debug").val(config);
        });
        AjaxGet("/db/Categories", function (data) {
            var dataObj = JSON.parse(data);
            for (var category in dataObj) {
                var catNum = parseInt(category) + 2;
                $("#tabLinks").append("<li><a href=\"#tab" + catNum + "\">" + dataObj[category] + "</a></li>");
                $("#tabContents").append("<div id=tab" + catNum + " class=\"tab\"></div>");
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