var hpainter;
var lastUpdate = 0;

function updateGUI() {
    if(hpainter == null) hpainter = new JSROOT.HierarchyPainter('root', 'wd1div');
    hpainter.SetDisplay("grid2x1", 'wd0div');

    hpainter.OpenRootFile("artdaqdemo_onmon.root", function() {
	    hpainter.displayAll(["wf0", "wf1"]);
	});    
};

function manageButtons(state, running, systemRunning) {
    var shutdownActive = $("#shutdown").hasClass("active") ? " active " : "";
    var startedActive = $("#started").hasClass("active") ? " active" : "";
    var initializedActive = $("#initialized").hasClass("active") ? " active" : "";
    var runStartedActive = $("#runStarted").hasClass("active") ? " active" : "";
    var runPausedActive = $("#runPaused").hasClass("active") ? " active" : "";

    var color = running ? "yellow" : "green";
    var sdColor = color;
    if (!systemRunning) { color = "red"; }

    switch (state) {
        case "Shutdown":
            color = systemRunning ? "yellow" : "green";
	    $("#shutdown").html("<span>System Shutdown</span>").attr("class", "animated blue visible");
		$("#started").html("<span>Start System</span>").attr("class", "animated visible " + color + startedActive);
            $("#initialized").html("<span></span>").attr("class", "animated red hidden");
            $("#runStarted").html("<span></span>").attr("class", "animated red hidden");
            $("#runPaused").html("<span></span>").attr("class", "animated red hidden");
            break;
        case "Started":
            $("#shutdown").html("<span>Shutdown System</span>").attr("class", "animated visible " + sdColor + shutdownActive);
            $("#started").html("<span>System Started</span>").attr("class", "animated blue visible");
            $("#initialized").html("<span>Initialize System</span>").attr("class", "animated visible " + color + initializedActive);
            $("#runStarted").html("<span></span>").attr("class", "animated red hidden");
            $("#runPaused").html("<span></span>").attr("class", "animated red hidden");
            break;
        case "Initialized":
            $("#shutdown").html("<span>Shutdown System</span>").attr("class", "animated visible " + sdColor + shutdownActive);
            $("#started").html("<span></span>").attr("class", "animated red hidden");
            $("#initialized").html("<span>System Initialized</span>").attr("class", "animated blue visible");
            $("#runStarted").html("<span>Start Run</span>").attr("class", "animated visible " + color + runStartedActive);
            $("#runPaused").html("<span></span>").attr("class", "animated red hidden");
            break;
        case "Running":
            $("#shutdown").html("<span></span>").attr("class", "animated red hidden");
            $("#started").html("<span></span>").attr("class", "animated red hidden");
            $("#initialized").html("<span>End Run</span>").attr("class", "animated visible " + color + initializedActive);
            $("#runStarted").html("<span>Running</span>").attr("class", "animated blue visible");
            $("#runPaused").html("<span>Pause Run</span>").attr("class", "animated visible " + color + runPausedActive);
            break;
        case "Paused":
            $("#shutdown").html("<span>Shutdown System</span>").attr("class", "animated visible " + sdColor + shutdownActive);
            $("#started").html("<span></span>").attr("class", "animated red hidden");
            $("#initialized").html("<span>Reinitialize System</span>").attr("class", "animated visible " + color + initializedActive);
            $("#runStarted").html("<span>Restart Run</span>").attr("class", "animated visible " + color + runStartedActive);
            $("#runPaused").html("<span>Run Paused</span>").attr("class", "animated blue visible");
            break;
    }

$(".green.animated").hover(function() {
	    $(this).addClass("active");
	}, function() {$(this).removeClass("active"); });
    
}

function update(dataJSON) {
    var data = $.parseJSON(dataJSON);
    manageButtons(data.state, data.commandRunning, data.systemRunning);
    //var sOut = $("#systemOut").val();
    //$("#systemOut").val(sOut + data.systemOutputBuffer);
    //var sErr = $("#systemErr").val();
    //$("#systemErr").val(sErr + data.systemErrorBuffer);
    //var cOut = $("#commOut").val();
    //$("#commOut").val(cOut + data.commandOutputBuffer);
    //var cErr = $("#commErr").val();
    //$("#commErr").val(cErr + data.commandErrorBuffer);

    
    $("#systemOut").val(data.systemOutputBuffer);
    $("#systemErr").val(data.systemErrorBuffer);
    $("#commOut").val(data.commandOutputBuffer);
    $("#commErr").val(data.commandErrorBuffer);
 

	if(data.WFPlotsUpdated && $("#monitoringEnabled").is(":checked")) {
	var updateDate = data.WFPlotsUpdated;
	if(updateDate > lastUpdate) {
      updateGUI();
      lastUpdate = updateDate;
    }
	} else {
	    hpainter = null;
            $("#wd0div").html("");
	}
}


function shutdownSystem() {
    if ($("#shutdown").is(".green")) {
        AjaxPost("/artdaq-runcontrol/Shutdown", { data: 0 }, update);
    }
}

function startSystem() {
    if ($("#started").is(".green")) {
        AjaxPost("/artdaq-runcontrol/Start", { data: 0 }, update);
    }
}

function initSystem() {
    if ($("#initialized").is(".green")) {
        if ($("#started").is(".blue")) {
            var verbosity = $("#verbosity").is(":checked");
            AjaxPost("/artdaq-runcontrol/Init", { dataDir: $("#dataDir").val(), verbose: verbosity, fileSize: $("#fileSize").val(), fileEvents: $("#fileEvents").val(), fileTime: $("#fileTime").val() }, update);
        }
        else {
            AjaxPost("/artdaq-runcontrol/End", { events: 0, time: 0 }, update);
            var number = parseInt($("#runNumber").val());
            $("#runNumber").val(number + 1);
        }
    }
}

function startRun() {
    if ($("#runStarted").is(".green")) {
        if ($("#runPaused").is(".blue")) {
            AjaxPost("/artdaq-runcontrol/Resume", { data: 0 }, update);
        } else {
            AjaxPost("/artdaq-runcontrol/Run", { runNumber: $("#runNumber").val(), runEvents: $("#runEvents").val(), runTime: $("#runTime").val() }, update);
        }
    }
}

function pauseRun() {
    if ($("#runPaused").is(".green")) {
        AjaxPost("/artdaq-runcontrol/Pause", { data: 0 }, update);
    }
}

$(document).ready(function () {
    $("#shutdown").click(function () {
        shutdownSystem();
    });
    $("#started").click(function () {
        startSystem();
    });
    $("#initialized").click(function () {
        initSystem();
    });
    $("#runStarted").click(function () {
        startRun();
    });
    $("#runPaused").click(function () {
        pauseRun();
    });
    $("#monitoringEnabled").change(function () {
	    if($("#monitoringEnabled").is(":checked")) {
		updateGUI();
            }
	});
    setInterval(function () { AjaxGet("/artdaq-runcontrol/", update); }, 1000);
    JSROOT.AssertPrerequisites('2d;io;', updateGUI);
});

