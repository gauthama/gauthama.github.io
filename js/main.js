/*jshint esnext: true */
/*global d3: true*/

//global variables

/*
 * Historical stock market data retrieved from yahoo finance.
 * 'data' is an array of quotes of a particular symbol between two dates.
 * A quote is an object with 'Symbol', 'Date', 'Low', 'High',
 * etc as keys.
 */
let data;
/*
 * The width and height of the line plot area.
 * Does not include the axes.
 */
const price_plot_w = 400, price_plot_h = 300;
const margin = {left: 60, top: 10, right: 60, bottom: 30};
// The small gap between the line plot area and the axes
const axis_padding = 3;
const num_x_ticks = 4, num_y_ticks = 4;
/*
 * Scales and axis functions
 */
let priceXScale, priceYScale;
let priceXAxis, priceYAxis;
/*
 * svg group elements that contain the line plot area,
 * the x axis, and the y axis.
 */
let price_plot_grp, price_x_axis_grp, price_y_axis_grp;
/*
 * The price type that is plotted.
 * Initially it is the 'Close' price.
 * This can be changed.
 */
let cur_price_type = "Close";
/* 
 * The actual line graph made of an svg path
 */
let price_line_graph;
/*
 * An array that consists of the range values
 * for the x axis ordinal scale.
 */
let x_range;
/*
 * This function sets the path of the line plot.
 */
let priceLineFunction = d3.svg.line()
                         .x((d) => priceXScale(d.Date))
                         .y((d) => 
                            priceYScale(+d[cur_price_type]))
                         .interpolate("linear");
/*
 * The circle showing the closest x coordinate
 * to the mouse.
 */
let price_plot_focus;
/*
 * An empty svg rect for enabling
 * mouse movement over the plot area.
 */
let price_plot_overlay;
/*
 * To add mouse event listeners
 * for the first plot.
 */
let clicked_once = false;

function onMousemove() {
  /*
   * Here 'this' is the svg element that generates
   * the mouse events. We use the x position([0]) only.
   */
  let x_pos = d3.mouse(this)[0];
  /*
   * Here we find out the two range elements
   * between which our x pos lies. Then we find out
   * the closest range value.
   */
  let range_index_left = d3.bisect(x_range, x_pos) - 1;
  let range_index_right = range_index_left + 1;
  let range_left_diff = x_pos - x_range[range_index_left];
  let range_right_diff = x_range[range_index_right] - x_pos;
  let range_index = (range_left_diff < range_right_diff) ? range_index_left : range_index_right;
  if (range_index > x_range.length - 1) {
    --range_index;
  }
  let cx = x_range[range_index];
  let cy = priceYScale(+data[range_index][cur_price_type]);
  price_plot_focus.attr({cx: cx, cy: cy});
  d3.select("#tooltip").select("#date").text(`Date: ${data[range_index].Date}`);
  d3.select("#tooltip").select("#price_type")
    .text(`${cur_price_type}: ${data[range_index][cur_price_type]}`);
  d3.select("#tooltip").style("left", cx + "px").style("top", Math.floor(cy - 10) + "px");
}


function plotPriceLine() {
  price_line_graph.attr("d", priceLineFunction(data));
}

function plotPriceXAxis() {
  price_x_axis_grp.call(priceXAxis);
}

function plotPriceYAxis() {
  price_y_axis_grp.call(priceYAxis);
}

function setPriceXScale() {
  let dates = data.map((d) => d.Date);
  priceXScale.domain(dates);
  x_range = priceXScale.range();
  let tick_span = Math.floor(dates.length/(num_x_ticks - 1));
  let ticks = priceXScale.domain().filter((d,i) => i % tick_span === 0);
  priceXAxis.tickValues(ticks);
}

function setPriceYScale() {
  let min_val = d3.min(data, (d) => +d[cur_price_type]);
  let max_val = d3.max(data, (d) => +d[cur_price_type]);
  let span = max_val - min_val;
  priceYScale.domain([min_val - span/2, max_val + span/2]);
}

function plotPriceGraph() {
  setPriceXScale();
  setPriceYScale();
  plotPriceXAxis();
  plotPriceYAxis();
  plotPriceLine();
}

function loadData(url) {
  return new Promise((resolve, reject) => {
    d3.json(url, function(err, d) {
      if (err) {
        console.log("Error:", err);
        reject(err);
        return;
      }
      resolve(d);
    });
  });
}

function getUrl(symbol, start_date, end_date){
  return `http://query.yahooapis.com/v1/public/yql?q=select * from yahoo.finance.historicaldata where symbol = \"${symbol}\" and startDate = \"${start_date}\" and endDate = \"${end_date}\"&format=json&env=store://datatables.org/alltableswithkeys`;
}


function onPlotBtnClick(){
  let symbol = document.getElementById("symbol_input").value;
  let start_date = document.getElementById("start_date_input").value;
  let end_date = document.getElementById("end_date_input").value;
  if ( symbol.trim() !== "" && start_date.trim() !== "" &&
      end_date.trim() !== "" ) {
    let url = encodeURI(getUrl(symbol, start_date, end_date));
    loadData(url).then((d) => {
      let quotes = d.query.results.quote;
      /*
       * The dates are received from end date to start date.
       * So we reverse the array to have the dates in increasing order.
       */
      data = quotes.map((el, i) => quotes[quotes.length - i - 1]);
      plotPriceGraph();
      if (! clicked_once ) {
        clicked_once = true;
        price_plot_overlay.on("mouseover", () => {
          price_plot_focus.style("display", null);
              d3.select("#tooltip").classed("hidden", false);})
          .on("mouseout", () => {
              price_plot_focus.style("display", "none");
              d3.select("#tooltip").classed("hidden", true);})
          .on("mousemove", onMousemove);
        
      }
    }).catch((err) => {
      let query_err_p = document.getElementById("query_err_p");
      query_err_p.innerHTML = "Error fetching data";
    });
  }
}

function init(){
  initPriceGraph();
  let plot_btn = document.getElementById("plot_btn");
  plot_btn.addEventListener("click", onPlotBtnClick);
}

function initPriceGraph(){
  let total_width = price_plot_w + margin.left + margin.right;
  let total_height = price_plot_h + margin.top + margin.bottom;
  let price_graph_svg = d3.select("#price_graph_div")
                          .append("svg")
                          .attr({width: total_width, height: total_height});
  price_plot_grp = price_graph_svg.append("g")
                                  .attr("transform", `translate(${margin.left}, ${margin.top})`);
  priceXScale = d3.scale.ordinal().rangePoints([0, price_plot_w]);
  priceYScale = d3.scale.linear().range([price_plot_h, 0]);
  price_x_axis_grp = price_graph_svg.append("g")
          .attr("transform", `translate(${margin.left}, ${total_height - margin.bottom + axis_padding})`)
          .attr("class", "axis");
  price_y_axis_grp = price_graph_svg.append("g")
                  .attr("transform", `translate(${margin.left - axis_padding}, ${margin.top})`)
                  .attr("class", "axis");
  
  priceXAxis = d3.svg.axis().orient("bottom").scale(priceXScale);
  priceYAxis = d3.svg.axis().orient("left").scale(priceYScale).ticks(num_y_ticks);
  price_line_graph = price_plot_grp.append("path")
                        .attr("class", "line");

  price_plot_focus = price_plot_grp.append("circle")
                        .attr("class", "focus")
                        .attr("r", 4.5)
                        .style("display", "none");
  price_plot_overlay = price_plot_grp.append("rect")
                          .attr("class", "rectoverlay")
                          .attr("width", price_plot_w)
                          .attr("height", price_plot_h);
}

init();

