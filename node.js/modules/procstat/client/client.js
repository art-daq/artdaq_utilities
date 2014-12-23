function AjaxPost(fnCallback) {
    // Check to see if there is currently an AJAX
    // request on this method.
    if (AjaxPost.Xhr) {
        // Abort the current request.
        AjaxPost.Xhr.abort();
    }
    // Get data via AJAX. Store the XHR (AJAX request
    // object in the method in case we need to abort
    // it on subsequent requests.
    AjaxPost.Xhr = $.ajax({
        type: "get",
        url: "/procstat/",
        dataType: "json",
        // Our success handler.
        success: function (objData) {
            // At this point, we have data coming back
            // from the server.
            fnCallback({
                Value1: objData
            });
        },
        // An error handler for the request.
        error: function (xhr, textStatus, errorCode) {
            //alert("An error occurred:\n" + textStatus + "\n" + errorCode);
        },
        // I get called no matter what.
        complete: function () {
            // Remove completed request object.
            AjaxPost.Xhr = null;
        }
    });
}


$(document).ready(function () {
    AjaxPost(function (data) {
        document.getElementById("procstat").innerHTML = data.Value1;
    });
});