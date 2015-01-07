var hpainter;

function getUrlParameter(sParam) {
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) {
            return sParameterName[1];
        }
    }
}
function updateGUI() {
    var key = getUrlParameter("pad");
    
    if (hpainter == null) hpainter = new JSROOT.HierarchyPainter('root', 'wd1div');
    hpainter.SetDisplay("grid1x1", 'wd0div');
    
    hpainter.OpenRootFile("artdaqdemo_onmon.root", function () {
        hpainter.displayAll([key]);
    });
}


(function ($, sr) {
    
    // debouncing function from John Hann
    // http://unscriptable.com/index.php/2009/03/20/debouncing-javascript-methods/
    var debounce = function (func, threshold, execAsap) {
        var timeout;
        
        return function debounced() {
            var obj = this, args = arguments;
            function delayed() {
                if (!execAsap)
                    func.apply(obj, args);
                timeout = null;
            }            ;
            
            if (timeout)
                clearTimeout(timeout);
            else if (execAsap)
                func.apply(obj, args);
            
            timeout = setTimeout(delayed, threshold || 100);
        };
    }
    // smartresize 
    jQuery.fn[sr] = function (fn) { return fn ? this.bind('resize', debounce(fn)) : this.trigger(sr); };

})(jQuery, 'smartresize');

$(document).ready(function () {
    JSROOT.AssertPrerequisites('2d;io;', updateGUI);
    $(window).smartresize(function () {
        $("#wd0div").width($(window).width());
        $("#wd0div").height($(window).height());
        updateGUI();
    });
});