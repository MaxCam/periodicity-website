d3.tsv("gdbData.tsv", function(d) {
  d.date = +d.date;
  d.close = +d.close;
  return d;
}, function(error, data) {
  if (error) throw error;



var svg = d3.select("svg"),
    margin = {top: 50, right: 10, bottom: 100, left: 50},
    width = +svg.attr("width") - margin.left - margin.right,
    height = +svg.attr("height") - margin.top - margin.bottom,
    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");



var x = d3.scaleLinear()
    .rangeRound([0, width]);

var y = d3.scaleLinear()
    .rangeRound([height, 0]);



var line = d3.line()
    .x(function(d) { return x(d.date); })
    .y(function(d) { return y(d.close); });

  x.domain(d3.extent(data, function(d) { return d.date; }));
  y.domain(d3.extent(data, function(d) { return d.close; }));

  g.append("g")
      .attr("transform", "translate(0," + y(0) + ")")
      .call(d3.axisBottom(x))
      .append("text")
      .attr("fill", "#000")
      .attr("transform", "rotate(0)")
      .attr("y", 4)
      .attr("dy", "2.21em")
      .style("text-anchor", "start")
      .text("Instant");
   




  g.append("g")
      .attr("class", "axis axis--y")
      .call(d3.axisLeft(y))
      .append("text")
      .attr("fill", "#000")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", "0.71em")
      .style("text-anchor", "end")
      .text("Sequence ID");

  g.append("path")
      .datum(data)
      .attr("class", "line")
      .attr("d", line);



  g.selectAll(".dot")
    .data(data)
    .enter().append("circle")
    .attr("class", "dot")
    .attr("cx", line.x())
    .attr("cy", line.y())
    .attr("r", 0.9);


});
