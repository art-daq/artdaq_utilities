function AjaxGet(getUrl, fnCallback) {
    // Check to see if there is currently an AJAX
    // request on this method.
    if (AjaxGet.Xhr) {
        // Abort the current request.
        AjaxGet.Xhr.abort();
    }
    // Get data via AJAX. Store the XHR (AJAX request
    // object in the method in case we need to abort
    // it on subsequent requests.
    AjaxGet.Xhr = $.ajax({
        type: "get",
        url: getUrl,
        dataType: "json",
        // Our success handler.
        success: function (objData) {
            // At this point, we have data coming back
            // from the server.
            fnCallback(objData);
        },
        // An error handler for the request.
        error: function (xhr, textStatus, errorCode) {
            //alert("An error occurred:\n" + textStatus + "\n" + errorCode);
        },
        // I get called no matter what.
        complete: function () {
            // Remove completed request object.
            AjaxGet.Xhr = null;
        }
    });
}

function AjaxPost(postUrl, postData, fnCallback) {
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
        type: "post",
        url: postUrl,
        dataType: "json",
        data: postData,
        // Our success handler.
        success: function (objData) {
            // At this point, we have data coming back
            // from the server.
            fnCallback(objData);
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