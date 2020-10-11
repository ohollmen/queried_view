/** Transform AoO datasets to charts (on client or server side).
*/
//var chtrans = {};

/////////////////////////// CHART OPS ////////////////////////
// TODO: Possibly call another function for pie and bar coloring (in pie dataset does not have color, but X value does)
function tochart(qp, result) { // Qv
  var chart = {labels: [], datasets: []};
  if (typeof qp != 'object') { return "qprof not passed as object"; }
  var lblprop = qp.lblprop;
  var cm = qp.chcols;
  if (!cm) { return "config.chcols not present"; }
  if (!Array.isArray(cm)) { return "config.chcols not an array"; }
  let i = 0;
  var st = qp.subtype || 'line';
  chart.typehint = st;
  cm.forEach(function (citem) {
    // borderColor / backgroundColor
    // Line: border
    // Bar: backgroundColor
    // Pie: backgroundColor []
    var ds = chart.datasets[i] = {label: citem.name, data: [], }; // borderColor: citem.color, backgroundColor: citem.color
    if (st == 'line') { ds.borderColor  = citem.color; } // background sometimes ok. TODO: lineWidth 1
    if (st == 'bar')  { ds.backgroundColor = citem.color; }
    if (st == 'pie')  { ds.backgroundColor = []; } // Or reset *once* outside loop
    if (citem.yaxid) { ds.yAxisID = citem.yaxid; }
    // 
    i++;
  });
  result.forEach(function (obj) {
    chart.labels.push(obj[lblprop]);
    let i = 0;
    cm.forEach(function (citem) { // cols
      chart.datasets[i].data.push(obj[citem.attr]);

      //if (st == 'pie') { chart.datasets[i].backgroundColor.push(); } // Random color !
      i++;
    })
  });
  if (st == 'pie') { piecolor(qp, chart); }
  return chart;
}
var COLORS = [
    '#4dc9f6',
    '#f67019',
    '#f53794',
    '#537bc4',
    '#acc236',
    '#166a8f',
    '#00a950',
    '#58595b',
    '#8549ba'
  ];
// Used by pie
function color (index) {
  return COLORS[index % COLORS.length];
}
// 
function piecolor(qp, chart) {
  console.log("Coloring pie ...");
  // likely 1, many allowed
  chart.datasets.forEach(function (ds) {
    ds.backgroundColor = [];
    var i = 0;
    chart.labels.forEach(function (lbl) {
      ds.backgroundColor[i] = color(i);
      i++;
    });

  });
}

// TODO: Consider assigning funcs directly to this namespace.
var chtrans = {
  tochart: tochart,
  COLORS: COLORS,
  color: color,
  piecolor: piecolor
};


if (!window && module) { module.exports = chtrans; }
