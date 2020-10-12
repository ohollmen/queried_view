/**
QueriedView and QueriedView - Set of QueriedView profiles.
*/
// Mysql query meta fields: Field, Type, Null, Key, Default, Extra

//qvs.prototype.addroutes = addroutes; // TEMP (see below)
//var qpset = new qvs(qprofiles, {debug: 0});
//qpset.addroutes(router, {simu: 0}); // qprofiles

var chtrans = require("./chtrans.js");
// Store at addroutes() as global singleton (for now).
// TODO: Pass in (e.g.) req.qpset
var qpset;
var tidx;
///////////////////////////////////////////////////////////
function qv() {}
qv.where = where;
qv.prototype.qcomp = qcomp;
qv.prototype.req2qpara = req2qpara;

/** Construct Queried View Set from one or more defs.
* Options
* - dbtype - DB type: mysql/sqlite (default: mysql, no need to pass)
* - debug - Set more verbose output during various ops
*/
function qvs(qps, opts) {
  opts = opts || {};
  this.qps = qps;
  if (opts.debug) { this.debug = 1; }
  // this.router = router;
  this.qmethod = "query"; // MySQL / 
  if (opts.dbtype == 'sqlite') { this.qmethod = "run"; } // // "run" sqlite
  if (typeof opts.debug != 'undefined') { this.debug = opts.debug; }
  qps.forEach(function (qp) {
    qp.__proto__ = qv.prototype;
  });
  this.debug && console.log(qps.length +" profs");
}

qvs.prototype.addroutes = addroutes;
qvs.req2prof = req2prof;
qvs.dclone = function (d) { return JSON.parse(JSON.stringify(d)); };
qvs.prototype.getq = getq;
// Get query profile by name
// Qvs(set, router)/Qv ()
function getq (name) {
  if (!name) { console.error("No name passed"); return null; }
  var qprofiles = this.qps;
  var n = qprofiles.filter(function (it) { return it.id == name; })[0];
  return n;
}
// Combine query clause components into a query.
function qcomp(p) { // Qv. (qp, p)
  var qp = this;
  var q = qp.sel; var w = "";
  // if (p) { w = where(p); }
  // return qp.sel + " " + qp.where + " " + qp.group;
  if (qp.where) { q += " "+qp.where; } // Add WHE... conditionally ?
  if (qp.group) { q += " "+qp.group; }
  return q;
}
// Form a where clause out of object keys and values
function where (p) { // Qv static
  var w = "";
  if (typeof p != 'object') { throw "Param not an object "; }
  var wcomps = [];
  Object.keys(p).forEach(function (k) {
    // Empty ? Array (and time type)
    if (!p[k]) { return; }
    wcomps.push( k+" = '"+ p[k] + "'" );
  });
  w = wcomps.join(" AND ");
  return w;
}
// Form a where in clause 
function wherein(vals) {
  if (!Array.isArray(vals)) { }
  // Preprocess to numeric ?
  var cnt = {str:0, num: 0};
  var i = 0;
  // Detect mixed ( => bad)?
  //for (;i<vals.length;i++) {
  //  if (typeof vals[i] == 'number') { cnt.num++; continue; }
  //  if (vals[i].match(/^\d+$/)) { vals[i] = parseInt(vals[i]); cnt.num++; }
  //  else { cnt.str++;}
  //}
  return vals.map((v) => {
    if (typeof v == 'number') {return v;}
    else if (typeof v == 'string') { v = v.replace(/'/g, "''"); return "'"+v+"'"; }
  }).join(',');
}
// Extract query params from HTTP request.
// Extracton is based on query profiles member params (array)
function req2qpara(req, opts) { // Qv (old: (qp, req))
  var qp = this;
  var extype = {"arr": function () {}, "obj": function () {}};
  var parr = [];
  var q = req.query;
  if (!q) { return parr; }
  var p = qp.params;
  if (!p) { return parr; }
  //if (Array.isArray(p)) {type = "arr"; }
  p.forEach(function (k) { parr.push(q[k]); });
  return parr;
}

function req2prof(req, jerr) { // stat
  var m; var qname;
  var path = req.url.split("?").shift();
  if (m = path.match(/^\/(\w+)$/)) { qname = m[1]; }
  else { jerr.msg += "Could not find search profile for: "+req.url; console.log(jerr.msg); return '';}
  return qname;
}

function addroutes(router, opts) { // Qvs
  var qviews = this;
  qpset = qviews; // Singleton
  opts = opts || {};
  var hdlrs = {"chart": chartview, "tab": tableview, "grid":tableview, "opts": optionsview};
  if (!router) { console.log(""); return; }
  var prepath = "/"; // By default on root
  if (opts.pathprefix) { prepath = opts.pathprefix; }
  var qps = qviews.qps;
  qps.forEach(function (qv) {
  // qvs.qvs.forEach(function (qv) {
    if (qv.disa) { return; }
    if (!hdlrs[qv.type]) { console.error("Warn: No handler for "+qv.type); return; }
    // Simple
    var url = prepath + qv.id;
    var hdlr = hdlrs[qv.type];
    // qvs !
    if (!opts.simu) { router.get(url, hdlr); }
    else { console.log("Path: " + url + " => Hdlr: ", typeof hdlr); }
  });
}

//////////////////////////////////////////////////////
var hdlrs = {
  tableview: tableview,
  chartview: chartview,
  
  optionsview:optionsview,
  qprofilesview: qprofilesview
};
function tableview(req, res) {
  var jerr = {"status" : "err", "msg": "DB Search failed. "};
  // var sel = "*";
  if (req.debug) {
    console.log("URL:"+req.url);
    console.log("Query-params:", req.query);
  }
  
  var qname = qvs.req2prof(req, jerr);
  if (!qname) { jerr.msg += "No query profile by:"+qname;return res.json(jerr); }
  var qn    = qpset.getq(qname); // 'chmerged'
  var debug = qn.debug || qpset.debug; // req.query.debug ?
  var qs    = qn.qcomp();
  var query = req.conn.query(qs,  function(err, result, flds) {
     if (err) { jerr.msg += err; res.json( jerr ); console.log(jerr.msg); return; }
     if (debug) { console.log(result); }
     res.json(result); // {status: ok, data: result}
  });
}


function chartview(req, res) {
  var jerr = {"status" : "err", "msg": "DB Search failed. "};
  var p = req.query;
  var qname = qvs.req2prof(req, jerr);
  if (!qname) { jerr.msg += "No query profile by:"+qname;return res.json(jerr); }
  var qn = qpset.getq(qname);
  var qs = qn.qcomp();
  //console.log("Query: ...", qn);
  //var qp = req2qpara(qn, req); // Validate (e.g. nulls) ?
  var qpara = qn.req2qpara(req);
  console.log("Req-Q-Params: ...", p);
  console.log("DBQParams(to mix-in?): ...", qpara);
  console.log("SQL-Query: "+ qs);
  var t0 = Date.now() / 1000;
  // Nonp query w. params (empty or full) ok, 
  var query = req.conn.query(qs ,qpara,  function(err, result, flds) {
    if (err) { jerr.msg += err; res.json( jerr ); return; }
    console.log("Got "+result.length+" result rows");
    if (qpset.debug) { console.log("Results(pre-trans): ", result); }
    //var chart = tobuildchart(qp, result);
    var chart = chtrans.tochart(qn, result);
    if (typeof chart == 'string') { jerr.msg += "Transformation to chart failed:" + chart; console.log(jerr.msg); return res.json(jerr); }
    chart.t = (Date.now() / 1000) - t0; // Timing info (Only on debug ?)
    if (qn.title) { chart.title = qn.title; }
    res.json(chart); // {status: ok, data: chart}
  });
}


// Figure all 3 combos: id, or name or both
function makeopts(arr, attr) {
  attr = attr || 'name';
  var makers = {
    'id': (it) => { it.id = it.name; },
    'name': (it) => { it.name = it.id; },
  };
  var cb;
  // var cnt = this.chcols.length;
  //if (cnt == 1) {
  //. if (this.chcols[0].attr == 'id') { cb = makers.name; }
  //. if (this.chcols[0].attr == 'name') { cb = makers.id; }
  //}
  return arr.map(function (it) {
    it.id = it[attr];
    //cb(it);
    return it;
  });
}

function optionsview(req, res) {
  var jerr = { "status" : "err", "msg": "DB Search (for options) failed. "};
  var qname = qvs.req2prof(req, jerr);
  if (!qname) { jerr.msg += "No query profile by:"+qname;return res.json(jerr); }
  var qn    = qpset.getq(qname);
  var debug = qn.debug || qpset.debug || 0;
  var qs    = qn.qcomp();
  var query = req.conn.query(qs,  function(err, result, flds) {
    if (err) { jerr.msg += err; res.json( jerr ); return; }
    //console.log(result);
    var opts = makeopts(result, 'name');
    if (debug > 1) { console.log("FLDS: "+ JSON.stringify(flds, null, 2)); }
    res.json(opts); // {status: ok, data: opts}
  });
}

function qprofilesview(req, res) {
  // Possibly clone, cut parent links
  // var d = qvs.dclone(qpset.qps);
  res.json(qpset.qps);
}
/**
* Note:
* TODO: Use async
*/
function tabinfo_load(conn, tabs) {
  //var
  tidx = {}; // Set stub
  if (!conn) { console.error("Need connection"); return; }
  if (!Array.isArray(tabs)) { console.error("Need tabs in array"); return; }
  function qtable(t, cb) {
    var qs = "SELECT * FROM "+t+" WHERE 0=1";
    var query = conn.query(qs,  function(err, result, flds) {
      if (err) { console.log("Error in query:"+qs); return; }
      //console.log(flds);
      tidx[t] = flds;
      //if (debug > 1) { console.log("FLDS: "+ JSON.stringify(flds, null, 2)); }
    
    });
  }
  tabs.forEach((t) => { qtable(t); });
}

/////////////////////////////////////////////////////
module.exports = {
  QueriedView: qv,
  QueriedViewSet: qvs,
  makeopts: makeopts,
  hdlrs: hdlrs
};
