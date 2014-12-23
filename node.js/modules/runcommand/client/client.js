var running = false;
function update(dataJSON) {
    var data = $.parseJSON(dataJSON);
    running = data.running;
    var oldOut = $("#stdOut").val();
    var oldErr = $("#stdErr").val();
    $("#stdOut").val(oldOut + data.out);
    $("#stdErr").val(oldErr + data.err);
    $("#exitCode").val(data.exitCode);
    if (running) {
        $(".whileRunning").show();
    } else {
        $(".whileRunning").hide();
    }
}

function runButtonClicked() {
    $("#exitCode").val("");
    $("#stdOut").val("");
    $("#stdErr").val("");
    AjaxPost("/runcommand/Run", { comm: $("#comm").val() }, update);
    $("#comm").val("");
};

function cancelButtonClicked() {
    AjaxPost("/runcommand/Abort", { Abort: 1 }, update);
};

function stdInButtonClicked() {
    AjaxPost("/runcommand/Input", { input: $("#input").val() }, update);
    $("#input").val("");
};



$(document).ready(function () {
    AjaxGet("/runcommand/", update)
    setInterval(function () {
        AjaxGet("/runcommand/", update)
    }, 1000);
});