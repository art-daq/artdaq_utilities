var defaultColor = "";
var defaultShadow = "";
var brs = {};
var configNeedsRestart = false;

function getUrlParameter(sParam) {
    var sPageUrl = window.location.search.substring(1);
    var sUrlVariables = sPageUrl.split("&");
    for (var i = 0; i < sUrlVariables.length; i++) {
        var sParameterName = sUrlVariables[i].split("=");
        if (sParameterName[0].search(sParam) > 0) {
            return sParameterName[1];
        }
    }
}

function checkExpertMode() {
    if ($("#expertMode").is(":checked")) {
        $(".expert").show();
    } else {
        $(".expert").hide();
    }
}

var addBR = function (id, br) {
    brs[id] = br;
    $.get("/artdaq-configuration/BoardReader.html", function (data) {
        var datatemp = data.replace(/%id%/g, id);
        $("#brs").append(datatemp).collapsibleset('refresh').trigger('create');
        $("#deletebr" + id).click(function () {
            $("#brcfg" + id).remove();
            $("#brs").collapsibleset('refresh');
        });
        $.get("/artdaq-configuration/GeneratorTypes", function (data) {
            $("#brcfg" + id + " #type").html(data).trigger('create').selectmenu('refresh');
            checkExpertMode();
            $("#brcfg" + id + " #type").change(function () {
                var selected = $("#brcfg" + id).find(':selected').val();
                $.get("/artdaq-configuration/" + selected, function (typedata) {
                    $("#brcfg" + id + " #typeConfig").html(typedata);
                    $("#brcfg" + id + " #typeConfig #config").trigger('create').collapsible();
                    
                    for (var key in brs[id].typeConfig) {
                        $("#" + key, "#brcfg" + id + " #typeConfig").val(brs[id].typeConfig[key]);
                        if ($(":radio[name=" + key + "]", "#brcfg" + id + " #typeConfig").is(":radio")) {
                            //var radioButton = $(":radio[value=" + brs[id].typeConfig[key] + "]","#brcfg" + id + " #typeConfig");
                            $(":radio[value=" + brs[id].typeConfig[key] + "]", "#brcfg" + id + " #typeConfig").prop("checked", true).checkboxradio('refresh');
                        }
                    }
                    checkExpertMode();
                });
            });
            
            if (brs[id] == null) {
                $("#brcfg" + id + " #type").val("Default").trigger('change');
            } else {
                if ($("#brcfg" + id + " #type option[value='" + brs[id].type + "_simulator.html']").length > 0) {
                    $("#brcfg" + id + " #type").val(brs[id].type + "_simulator.html").trigger('change');
                } else if ($("#brcfg" + id + " #type option[value='" + brs[id].type + "_receiver.html']").length > 0) {
                    $("#brcfg" + id + " #type").val(brs[id].type + "_receiver.html").trigger('change');
                } else if ($("#brcfg" + id + " #type option[value='" + brs[id].type + "_reader.html']").length > 0) {
                    $("#brcfg" + id + " #type").val(brs[id].type + "_reader.html").trigger('change');
                } else {
                    $("#brcfg" + id + " #type").val("Default").trigger('change');
                }
            }
        });
        
        if (br != null) {
            $("#brcfg" + id + " #enabled").prop('checked', br.enabled).checkboxradio('refresh');
            $("#brcfg" + id + " #name").val(br.name);
            $("#brcfg" + id + " #hostname").val(br.hostname);
        }
    });
}

var lastbrid = 0;

var saveConfiguration = function () {
    var output = {};
    output.expertMode = $("#expertMode").is(":checked");
    output.configName = $("#configName").val();
    output.artdaqDir = $("#artdaqDir").val();
    output.dataDir = $("#artdaqDataDir").val();
    output.logDir = $("#artdaqLogDir").val();
    output.setupScript = $("#artdaqSetupScript").val();
    output.needsRestart = configNeedsRestart;
    output.dataLogger = {};
    output.dataLogger.enabled = $("#dlEnabled").is(":checked");
    output.dataLogger.fileMode = $("input:radio[name=fileLimit]:checked").val();
    output.dataLogger.fileValue = $("#limitValue").val();
    output.dataLogger.runMode = $("input:radio[name=runLimit]:checked").val();
    output.dataLogger.runValue = $("#runLimitValue").val();
    output.dataLogger.hostname = $("#aggHostname").val();
    output.dataLogger.name = $("#dlName").val();
    output.onlineMonitor = {};
    output.onlineMonitor.hostname = $("#aggHostname").val();
    output.onlineMonitor.enabled = $("#omEnabled").is(":checked");
    output.onlineMonitor.viewerEnabled = $("#omvEnabled").is(":checked");
    output.onlineMonitor.name = $("#omName").val();
    output.eventBuilders = {};
    output.eventBuilders.basename = $("#evbName").val();
    output.eventBuilders.count = $("#evbCount").val();
    output.eventBuilders.compress = $("#evbCompress").is(":checked");
    output.eventBuilders.hostnames = $("#evbHostnames").val().split(",");
    output.boardReaders = [];
    $("#brs").children().each(function (index, element) {
        var br = {};
        var selected = $(this).find(':selected');
        br.type = selected.text();
        br.hostname = $("#hostname", this).val();
        br.name = $("#name", this).val();
        br.enabled = $("#enabled", this).is(":checked");
        br.typeConfig = {};
        $("#typeConfig input:radio", this).each(function (innerIndex, innerElement) {
            if ($(innerElement).is(":checked")) {
                br.typeConfig[innerElement.name] = $(innerElement).val();
            }
        });
        $("#typeConfig input", this).each(function (innerIndex, innerElement) {
            if ($(innerElement).is(":checkbox")) {
                br.typeConfig[innerElement.id] = $(innerElement).is(":checked");
            } else if (!$(innerElement).is(":radio")) {
                br.typeConfig[innerElement.id] = $(innerElement).val();
            }
        });
        output.boardReaders.push(br);
    });
    return output;
};

var loadConfiguration = function (config) {
    lastbrid = 0;
    $("#brs").html("");
    
    $("#expertMode").prop('checked', config.expertMode);
    $("#configName").val(config.configName);
    $("#artdaqDir").val(config.artdaqDir);
    $("#artdaqDataDir").val(config.dataDir);
    $("#artdaqLogDir").val(config.logDir);
    $("#artdaqSetupScript").val(config.setupScript);
    $("#dlEnabled").prop('checked', config.dataLogger.enabled);
    $("#dlName").val(config.dataLogger.name);
    $("#aggHostname").val(config.dataLogger.hostname);
    $("input:radio[name=fileLimit]:checked").prop('checked', false);
    $("#fileLimit" + config.dataLogger.fileMode).prop('checked', true);
    $("#limitValue").val(config.dataLogger.fileValue);
    $("input:radio[name=runLimit]:checked").prop('checked', false);
    $("#runLimit" + config.dataLogger.runMode).prop('checked', true);
    $("#runLimitValue").val(config.dataLogger.runValue);
    $("#omEnabled").prop('checked', config.onlineMonitor.enabled);
    $("#omvEnabled").prop('checked', config.onlineMonitor.viewerEnabled);
    $("#omName").val(config.onlineMonitor.name);
    $("#evbName").val(config.eventBuilders.basename);
    $("#evbCount").val(config.eventBuilders.count);
    $("#evbCompress").prop('checked', config.eventBuilders.compress);
    if (typeof (config.eventBuilders.hostnames) == "string") {
        $("#evbHostnames").val(config.eventBuilders.hostnames);
    } else {
        $("#evbHostnames").val(config.eventBuilders.hostnames.join());

    }
    
    if (config.boardReaders.name != null) {
        ++lastbrid;
        addBR(lastbrid, config.boardReaders);
    } else {
        for (var index in config.boardReaders) {
            var br = config.boardReaders[index];
            ++lastbrid;
            addBR(lastbrid, br);
        }
    }
    $("input:radio").checkboxradio('refresh');
    $("input:checkbox").checkboxradio('refresh');
    checkExpertMode();
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

var loadConfigs = function () {
    AjaxGet("/artdaq-configuration/NamedConfigs", function (data) {
        $("#configs").html(data.join("")).trigger('create').selectmenu('refresh');
        var config = getUrlParameter("configs");
        if (config !== undefined) {
            $("#configs").val(config);
        }
        $("#loadConfigButton").trigger('click');
    });
}

$(document).ready(function () {
    defaultColor = $("#header").css("background-color");
    defaultShadow = $("#header").css("text-shadow");
    var changedText = "Please define a Configuration Name and click \"Save Configuration\" to save your pending changes. Loading a configuration, navigating away from this page, or closing this page will discard your changes.";
    
    $("#expertMode").click(function () {
        checkExpertMode();
    });
    checkExpertMode();
    
    $(".triggersModified").change(function () {
        updateHeader(true, changedText);
    });
    
    $(".triggersModified").click(function () {
        updateHeader(true, changedText);
    });
    
    $(".triggersRestart").click(function () {
        configNeedsRestart = true;
        updateHeader(true, changedText + "\nYou will have to re-start any ARTDAQ partitions using this configuration to apply these changes.");
    });
    
    $("#addbr").click(function () {
        ++lastbrid;
        addBR(lastbrid);
    });
    
    $("#loadConfigButton").click(function () {
        configNeedsRestart = false;
        updateHeader(false, "");
        var selected = $("#configs").find(':selected').val();
        AjaxPost("/artdaq-configuration/LoadNamedConfig", { configFile: selected }, function (config) {
            loadConfiguration(config);
        });
    });
    loadConfigs();
    
    $("#saveConfig").click(function () {
        var config = saveConfiguration();
        AjaxPost("/artdaq-configuration/saveConfig", { config: JSON.stringify(config) }, function (res) {
            if (res !== null && res.Success) {
                updateHeader(false, "Configuration Saved.");
            } else {
                updateHeader(true, "Failed to save configuration!");
            }
            
            loadConfigs();
        });
    });
});