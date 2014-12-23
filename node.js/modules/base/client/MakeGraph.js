var n = 120, //Displayed time range is n * duration, so default is 60 seconds.
    duration = 500; //ms between updates

function tick(paths, line, axes, x, y, ids, tag) {
    var transition = d3.select(tag).transition()
                .duration(duration)
                .ease("linear");
    transition = transition.each(function () {
        
        // update the domains
        now = new Date();
        x.domain([now - (n - 1 ) * duration, now ]);
        
        var extent = [0x1000000, 0];
        for (var name in ids) {
            var group = ids[name];
            var thisExtent = d3.extent(group.data, function (d) { return d.value; });
            if (thisExtent[0] < extent[0]) { extent[0] = thisExtent[0]; }
            if (thisExtent[1] > extent[1]) { extent[1] = thisExtent[1]; }
        }
        y.domain([extent[0] * 98 / 100, extent[1] * 102 / 100]);
        
        for (var name in ids) {
            d3.json(ids[name].jsonPath, function (json) {
                ids[json.name].data.push({ value: json.value, time: new Date(json.time) });
            });
            
            // redraw the line
            ids[name].path.attr("d", line).attr("transform", null);
        }
        
        // slide the x-axis left
        axes[0].call(x.axis);
        axes[1].call(y.axis);
        
        for (var name in ids) {
            ids[name].path
            .transition()
            .duration(duration)
            .ease("linear")
            .attr("transform", "translate(" + x(now - n * duration) + ")");
        }
        
        for (var name in ids) {
            while (ids[name].data.length > 0 && ids[name].data[0].time < now - n * duration) {
                ids[name].data.shift();
            }
        }

    }).transition().each("start", function () { setTimeout(tick(paths, line, axes, x, y, ids, tag), (duration * 3) / 4) });
}

function makeGraph(tag, ids) {
    var now = new Date(Date.now() - duration);
    
    var margin = { top: 6, right: 20, bottom: 20, left: 60 },
        width = $(tag).width() - margin.right - margin.left,
        height = 120 - margin.top - margin.bottom;
    
    var x = d3.time.scale()
                .range([0, width]);
    
    var y = d3.scale.linear()
                .range([height, 0]);
    
    var line = d3.svg.line()
                .interpolate("linear")
                .x(function (d) { return x(d.time); })
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
        return prefix.scale(d) + " " + prefix.symbol + "B/s";
    }
    var yaxis = svg.append("g")
                .attr("class", "y axis")
                .attr("transform", "translate(0,0)")
                .call(y.axis = d3.svg.axis().scale(y).tickFormat(formatTick).orient("left"));
    
    var paths = svg.append("g")
                .attr("clip-path", "url(#clip"+tag.replace('#',"")+")");
    
    for (var name in ids) {
        ids[name].path = paths.append('path')
                .data([ids[name].data])
                .attr('class', 'line')
                .style('stroke', ids[name].color);
    }
    
    tick(paths, line, [xaxis, yaxis], x, y, ids, tag);
}