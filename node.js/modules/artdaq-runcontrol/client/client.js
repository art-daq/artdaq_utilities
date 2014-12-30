function shutdownSystem() {
    if($("#shutdown").is(".green")){
        $("#shutdown").html("<span>System Shutdown</span>").attr("class","blue visible");
        $("#started").html("<span>Start System</span>").attr("class","green visible");
        $("#initialized").html("<span></span>").attr("class","red hidden");
        $("#runStarted").html("<span></span>").attr("class","red hidden");
        $("#runPaused").html("<span></span>").attr("class","red hidden");
    }
}

function startSystem() {
    if($("#started").is(".green")) {
        $("#shutdown").html("<span>Shutdown System</span>").attr("class","green visible");
        $("#started").html("<span>System Started</span>").attr("class","blue visible");
        $("#initialized").html("<span>Initialize System</span>").attr("class","green visible");
        $("#runStarted").html("<span></span>").attr("class","red hidden");
        $("#runPaused").html("<span></span>").attr("class","red hidden");
    }
}

function initSystem() {
    if($("#initialized").is(".green")) {
        $("#shutdown").html("<span>Shutdown System</span>").attr("class","green visible");
        $("#started").html("<span></span>").attr("class","red hidden");
        $("#initialized").html("<span>System Initialized</span>").attr("class","blue visible");
        $("#runStarted").html("<span>Start Run</span>").attr("class","green visible");
        $("#runPaused").html("<span></span>").attr("class","red hidden");
    }
}

function startRun() {
    if($("#runStarted").is(".green")) {
        $("#shutdown").html("<span></span>").attr("class","red hidden");
        $("#started").html("<span></span>").attr("class","red hidden");
        $("#initialized").html("<span>End Run</span>").attr("class","green visible");
        $("#runStarted").html("<span>Running</span>").attr("class","blue visible");
        $("#runPaused").html("<span>Pause Run</span>").attr("class","green visible");
    }
}

function pauseRun() {
    if($("#runPaused").is(".green")) {
        $("#shutdown").html("<span>Shutdown System</span>").attr("class","green visible");
        $("#started").html("<span></span>").attr("class","red hidden");
        $("#initialized").html("<span>Reinitialize System</span>").attr("class","green visible");
        $("#runStarted").html("<span>Restart Run</span>").attr("class","green visible");
        $("#runPaused").html("<span>Run Paused</span>").attr("class","blue visible");
    }
}

$(document).ready(function(){
    $("#shutdown").click(function(){
        shutdownSystem();
    });
    $("#started").click(function(){
        startSystem();
    });
    $("#initialized").click(function(){
        initSystem();
    });
    $("#runStarted").click(function(){
        startRun();
    });
    $("#runPaused").click(function(){
        pauseRun();
    });
    shutdownSystem();
});

