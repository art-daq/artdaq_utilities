function runButtonClicked() {
    AjaxPost("/runcommand/Run", { comm: $("#comm").val() }, function (data) {
        document.getElementById("output").innerHTML = data.Value1;
    });
    $("#comm").val("");
};

function cancelButtonClicked() {
    AjaxPost("/runcommand/Abort", { Abort: 1 }, function (data) {
        document.getElementById("output").innerHTML += data.Value1;
    });
};

function stdInButtonClicked() {
    AjaxPost("/runcommand/Input", { input: $("#input").val() }, function (data) {
        document.getElementById("output").innerHTML += data.Value1;
    });
    $("#input").val("");
};

$(document).ready(function () {
    setInterval(function () {
        AjaxGet("/runcommand/", function (data) {
            document.getElementById("output").innerHTML += data.Value1;
        })
    }, 1000);
});