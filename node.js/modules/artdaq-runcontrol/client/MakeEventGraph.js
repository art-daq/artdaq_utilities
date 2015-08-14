// Variables common to all graphs
var duration = 1000; // Transition animation duration
var colors = ["black","red","blue","green", "yellow","gray","fuchsia","navy","olive", "aqua", "lime", "maroon", "orange", "purple", "silver", "teal"];
var graphs = [];
var events = [];
var currentEvent = 0;
var eventsBehind = 0;
var partition = 0;
var moduleName = "artdaq-runcontrol";
var fetching = false;
var updateInterval = 500;

function tick(graph, event) {
    var transition = d3.select(graph.tag).transition()
	 .duration(duration)
	.ease("linear").attrTween("transform", function () {

		var vals = $.map(event.fragments, function(v) {
			return v.data[graph.dataElement];
		    });
		$("#p" + partition + graph.dataElement + "value").text("Current Value(s): " + vals);
		
		for(var name in graph.data) {
		    var plotName = graph.data[name].name;
		    var value = vals[name];
		    graph.data[name].data.push({event:event.event,value:value});
		}

		// update the domains
		var xextent = [currentEvent, currentEvent];
		for(var name in graph.data) {
		    var group = graph.data[name];
		    var thisExtent = d3.extent(group.data,function(d) { return d.event;});
		    if(thisExtent[0] < xextent[0]){xextent[0] = thisExtent[0];}
		}
		graph.x.domain(xextent);
        
		var extent = [0x1000000, 0];
		for (var name in graph.data) {
		    var group = graph.data[name];
		    var thisExtent = d3.extent(group.data, function (d) { return d.value; });
		    if (thisExtent[0] < extent[0]) { extent[0] = thisExtent[0]; }
		    if (thisExtent[1] > extent[1]) { extent[1] = thisExtent[1]; }
		}
		graph.y.domain([extent[0] * 98 / 100, extent[1] * 102 / 100]);
        

		// slide the x-axis left
		graph.axes[0].call(graph.x.axis);
		graph.axes[1].call(graph.y.axis);
	
		for(var name in graph.data) {	
		    // redraw the line
		    graph.data[name].path
			.attr("d", graph.line)
			.attr("transform", null)
			.transition()
			.duration(duration)
			.ease("linear")
			.attr("transform", "translate(" + graph.x(xextent[0]) + ")");
                    
		    if(graph.caughtUp) { 
		    	graph.data[name].data = graph.data[name].data.sort(function(a,b) { return a.event - b.event; });
                    }
		    while (graph.data[name].data.length > 0 && graph.data[name].data[0].event < currentEvent - graph.n) {
			graph.data[name].data.shift();
		    }
		}

		if(graph.caughtUp) { graph.caughtUp = false;}
	    }).transition();
    return graph;
}

function DeleteGraph(dataElement) {
    $("#p" + partition + dataElement + "plot").remove();
}

function MakeEventGraph(tag, dataElement) {
    data = [];
    var margin = { top: 6, right: 20, bottom: 20, left: 60 },
        width = $(tag).width() - margin.right - margin.left,
	height = 120 - margin.top - margin.bottom;
    
    var x = d3.scale.linear()
	      .range([0, width]);
    
    var y = d3.scale.linear()
	      .range([height, 0]);
    
    var line = d3.svg.line()
	         .interpolate("linear")
	         .x(function (d) { return x(d.event); })
	         .y(function (d) { return y(d.value); });
    
    var svg = d3.select(tag).append("svg")
	        .attr("width", width + margin.left + margin.right)
	        .attr("height", height + margin.top + margin.bottom)
	        .style("margin-left", -margin.right + "px")
	        .append("g")
	        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    svg.append("defs").append("clipPath")
       .attr("id", "clip" + tag.replace('#', ""))
       .append("rect")
       .attr("width", width)
       .attr("height", height);
    
    var xaxis = svg.append("g")
  	           .attr("class", "x axis")
	           .attr("transform", "translate(0," + height + ")")
	           .call(x.axis = d3.svg.axis().scale(x).orient("bottom"));
    
    var formatTick = function (d) {
	var prefix = d3.formatPrefix(d);
	return prefix.scale(d) + " " + prefix.symbol + "";
    }
    
    var yaxis = svg.append("g")
                   .attr("class", "y axis")
	           .attr("transform", "translate(0,0)")
	           .call(y.axis = d3.svg.axis().scale(y).tickFormat(formatTick).orient("left"));
    
    var paths = svg.append("g")
	           .attr("clip-path", "url(#clip" + tag.replace('#', "") + ")");

    var fragCount = events[0].fragments.length;
    
    for (var i = 0; i < fragCount; i++) {
	if(events[0].fragments[i].data[dataElement]) {
        var color = colors[i%colors.length];
        var thisData = {};
        thisData.name = i;
        thisData.data = [];
	for(var j = 0; j < events.length; j++) {	
	    var value = events[j].fragments[i].data[dataElement];
	    thisData.data.push({event:events[j].event,value: value});
	}
        thisData.path = paths.append('path')
                .data([thisData.data])
                .attr('class', 'line')
	    .style('stroke', color);
	data.push(thisData);
	}
    }
    
    this.paths = paths;
    this.line = line;
    this.axes = [xaxis, yaxis];
    this.dataElement = dataElement;
    this.x = x;
    this.y = y;
    this.data = data;
    this.tag = tag;
    this.n = 120;
    this.update = function(event) { return tick(this, event); };
}

function RedrawGraph(graph) {
    for(var name in graph.data) {
	while(graph.data[name].data.length > 0) {
	    graph.data[name].data.shift();
	}
    }

    for(var i = 0; i < events.length - 1; i++) {
	var vals = $.map(events[i].fragments, function(v) {
		return v.data[graph.dataElement];
	    });
	
	for(var name in graph.data) {
	    var plotName = graph.data[name].name;
	    var value = vals[name];
	    graph.data[name].data.push({event:events[i].event,value:value});
	}
    }	

    graph.update(events[events.length - 1]);
}

function CreateEventPlot(partition, dataElement)
{
    if($("#p" + partition + dataElement + "plot").length == 0) {
    $("#plots").append("<div id=\"p" +partition + dataElement + "plot\">"
                     + "<h3>"+dataElement+"</h3>"
                     +" <label id=\"p"+partition+dataElement+"value\"></label>&nbsp;&nbsp;"
	             + "<label>Number of Points to Plot:<input type=\"number\" min=1 value=120 id=\"p"+partition+dataElement+"nSelector\"></label>&nbsp;&nbsp;"
                     + "<button type=\"button\" id=\"p"+ partition + dataElement + "deletebutton\">Delete</button>"
                     + "<br>"
                     + "<div id=\"p" + partition + dataElement + "\"></div><br></div>");
    $("#p"+partition+dataElement +"deletebutton").click(function() { DeleteGraph(dataElement); });
    $("#p"+partition+dataElement +"nSelector").bind('keyup input', function() { graphs[dataElement].n = $("#p"+partition+dataElement+"nSelector").val(); RedrawGraph(graphs[dataElement]);});
    graphs[dataElement] = new MakeEventGraph("#p" + partition + dataElement, dataElement);
    graphs[dataElement].update(events[events.length - 1]);
    }
}

function Contains(arr, val)
{
for (var i = 0; i < arr.length; i++) {
        if (arr[i] === val) {
            return true;
        }
    }
    return false;
}

function UpdateGraphs()
{
    if(!fetching) {
	fetching = true;
	var postData = {event: currentEvent, partition: partition};
	d3.json("/"+moduleName+"/GetEvent").post(JSON.stringify(postData), function(error, data) {
		//console.log("Data is " + data);
		if(data && data != "" && data != "ENOEVT") {
		    updateInterval = 500;
		    var dataJSON = JSON.parse(data);
		    events.push(dataJSON);
		    var bigN = 120;
		    for(var graph in graphs) {
			if(graphs[graph].n > bigN) { bigN = graphs[graph].n; }
			graphs[graph] = graphs[graph].update(dataJSON);
		    }
		    while(events.length > bigN) { events.shift(); }
		    currentEvent = dataJSON.event + 1;
		    eventsBehind = dataJSON.lastEvent - dataJSON.event - 1;
		}
		else if(data && data == "ENOEVT") {
		    currentEvent++;
		    eventsBehind = 1;
		}
		else {
		    if(updateInterval < 10000) {
			//Back off a bit
			updateInterval += 500;
		    }
		}
		fetching = false;
	});
    }

    var gotBehind = false;
    if(eventsBehind > 1 ) {
	updateInterval = 10;
	gotBehind = true;
    }

    for(var graph in graphs) {
	if(!gotBehind && graphs[graph].gotBehind) { graphs[graph].caughtUp = true; }
	graphs[graph].gotBehind = gotBehind;
    }

    setTimeout(function() { UpdateGraphs(); }, updateInterval);
}


function Onmon(tag, part, module)
{
    moduleName = module;
    partition = part;

    graphs = [];
    events = [];
    currentEvent = 0;
    eventsBehind = 0;

    var postData = {event: 0, partition: partition};
    d3.json("/"+moduleName+"/GetEvent").post(JSON.stringify(postData), function(error, serverdata) {
	    var data = JSON.parse(serverdata);
	    var names = [];
	    for(var frag in data.fragments) {
		var fragData = data.fragments[frag];
		if(fragData.header.data_type === 1) {
		    for(var iterator in fragData.data) {
			if(!Contains(names, iterator)) {
			    names.push(iterator);
			}
		    }
		}
	    }

	    var output = "";
	    for(var iterator in names) {
		output += "<option value=\"" + names[iterator] + "\">" + names[iterator] + "</option>\n";
	    }
	    $(tag).html( "<fieldset>\n"
			 + "<select id=\"newPlotElement\">\n"
			 + output
			 + "</select>"
			 + "<button type=\"button\" id=\"addPlot\" onclick=\"CreateEventPlot(" + partition + ",$('#newPlotElement').val())\">Add</button>\n"
			 + "<div id=\"plots\"></div>"
			 + "</fieldset>");
	});
    
    UpdateGraphs();
}
