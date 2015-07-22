var artStarted = false;

function manageButtons( artRunning ) {
    if(artRunning) {
	$("#shutdown").html("<span>Stop UDPDump</span>").attr("class","animated green visible");
	$("#started").html("<span>UDPDump Running</span>").attr("class","animated blue visible");
    } else {
	$("#shutdown").html("<span>UDPDump Not Running</span>").attr("class","animated blue visible");
	$("#started").html("<span>Start UDPDump</span>").attr("class","animated green visible");
    }

    $( ".green.animated" ).hover( function () {
        $( this ).addClass( "active" );
    },function () { $( this ).removeClass( "active" ); } );
}

function update( data ) {
    //var data = $.parseJSON( dataJSON );
    manageButtons( data.running );

   
    var out = $("#out")[0];
    var err = $("#err")[0];
    var outAtBottom = out.scrollTop + out.clientHeight >= out.scrollHeight - 10;
    var errAtBottom = err.scrollTop + err.clientHeight >= err.scrollHeight - 10;
    $( "#out" ).val( data.out );
    $( "#err" ).val( data.err );
    if(outAtBottom) { out.scrollTop = out.scrollHeight };
    if(errAtBottom) { err.scrollTop = err.scrollHeight };

    if(artStarted) {
	setTimeout(function() {Onmon("#wd0div",0,"udpdump");}, 1000);
	artStarted = false;
    }

    if(data.running) { setTimeout(function() { AjaxGet( "/udpdump/Log", update); }, 1000); }
}

function getFileNames() {
    $.get("/udpdump/FileNames", function(result) {
	    $("#fileName").html(result);
	});
}

function shutdownSystem() {
    if ( $( "#shutdown" ).is( ".green" ) ) {
        AjaxPost( "/udpdump/Kill",{ },update );
    }
}

function startSystem() {
    if ( $( "#started" ).is( ".green" ) ) {
	artStarted = true;
	$("#wd0div").empty();
        AjaxPost( "/udpdump/Start",{ fileIndex: $( "#fileName" )[0].selectedIndex },update );
    }
}

$( document ).ready( function() {
	$("#shutdown").click(function() {
		shutdownSystem();
	    });
	$("#started").click(function() {
		startSystem();
	    });

	getFileNames();
	$("#reloadFileNames").click(function() {
		getFileNames();
	    });

	AjaxGet("/udpdump/Log", update);
    });