/**
QueriedView and QueriedView - Set of QueriedView profiles.

## Testing basic queries with Mysql (e.g. params)

var mysql = require("mysql");
var cfg = require("./dbconn.json");
var conn  = mysql.createPool( cfg );
cfg.dbconn["acquireTimeout"] = 30000;
var conn  = mysql.createPool( cfg.dbconn );
var qs = "SELECT * FROM mytable WHERE field ";
var qpara = [];
var query = conn.query(qs ,qpara,  function(err, result, flds) {
  if (err) { console.log("Error: "+err); return; }
  console.log("Query: "+qs);
  console.log("Query-params: ",qpara);
  console.log(result.length + " Rows.");
  //console.log(results);
  process.exit(1);
});

https://www.npmjs.com/package/mysql#escaping-query-identifiers

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
// We merely cast to this by __proto__
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
  var arr = vals.map((v) => {
    if (typeof v == 'number') {return v;}
    else if (typeof v == 'string') { v = v.replace(/'/g, "''"); return "'"+v+"'"; }
  }); // .join(',');
  return arr.join(', ');
}
// Inversion of between (by NOT) should be done by caller
function between(vals) {
  if (!Array.isArray(vals)) { return; }
  if (vals.length != 2) { return; }
  // Quote intelligently
  // No CAST('2003-01-01' AS DATE) needed for time fields (as told by some legacy mysql doc)
  return " BETWEEN "+vals.join(" AND ");
}
// Extract query params from HTTP request.
// Extracton is based on query profiles member params (array)
// By driving by qp.params we get deterministic order of params.
function req2qpara(req, opts) { // Qv (old: (qp, req))
  var qp = this;
  var extype = {"arr": function () {}, "obj": function () {}};
  var parr = [];
  var q = req.query;
  if (!q) { return parr; }
  var p = qp.params;
  if (!p) { return parr; }
  function isfunc(v) {
    return (typeof v == 'function') ? 1 : 0;
  }
  //if (Array.isArray(p)) {type = "arr"; }
  p.forEach(function (k) {
    var v = q[k]; // By default grab from query
    if (!v && qp.defpara) {
      v = qp.defpara[k];
      if (Array.isArray(v)) {
        
        //parr = parr.concat(v);
	v.forEach((val) => {
	  //if (typeof val == 'function') { parr.push(val()); }
	  //else { parr.push(val); }
	  parr.push(isfunc(val) ? val() : val);
	});
	return;
      }
    }
    if (!v) { console.log("req2qpara: Warning: No value from query or defaults: "+k); }
    parr.push(isfunc(v) ? v() : v);
  });
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
  var qn    = qpset.getq(qname);
  var debug = qn.debug || qpset.debug; // req.query.debug ?
  
  var qpara = qn.req2qpara(req); // [];
  var qs    = qn.qcomp();
  var query = req.conn.query(qs, qpara, function(err, result, flds) {
     if (err) { jerr.msg += err; res.json( jerr ); console.log(jerr.msg); return; }
     if (debug) { console.log(result); }
     res.json({status: "ok", data: result}); // 
  });
}


function chartview(req, res) {
  var jerr = {"status" : "err", "msg": "DB Search failed. "};
  var p = req.query;
  var qname = qvs.req2prof(req, jerr);
  if (!qname) { jerr.msg += "No query profile by:"+qname;return res.json(jerr); }
  var qn = qpset.getq(qname);
  var qpara = qn.req2qpara(req);
  var qs = qn.qcomp();
  console.log("Req-Q-Params: ...", p);
  console.log("DBQParams(to mix-in?): ...", qpara);
  console.log("SQL-Query: "+ qs);
  var t0 = Date.now() / 1000;
  // Nonp query w. params (empty or full) ok, 
  var query = req.conn.query(qs ,qpara,  function(err, result, flds) {
    if (err) { jerr.msg += err; res.json( jerr ); return; }
    console.log("Got "+result.length+" result rows");
    if (qpset.debug > 1) { console.log("Results(pre-trans): ", result); }
    var chart = chtrans.tochart(qn, result);
    if (typeof chart == 'string') { jerr.msg += "Transformation to chart failed:" + chart; console.log(jerr.msg); return res.json(jerr); }
    chart.t = (Date.now() / 1000) - t0; // Timing info (Only on debug ?)
    if (qn.title) { chart.title = qn.title; }
    res.json({status: "ok", data: chart}); // 
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
  //var qpara = qn.req2qpara(req);
  var qs    = qn.qcomp();
  var query = req.conn.query(qs,  function(err, result, flds) {
    if (err) { jerr.msg += err; res.json( jerr ); return; }
    //console.log(result);
    var opts = makeopts(result, 'name');
    if (debug > 1) { console.log("FLDS: "+ JSON.stringify(flds, null, 2)); }
    res.json({status: "ok", data: opts}); // 
  });
}

function qprofilesview(req, res) {
  // Possibly clone, cut parent links
  // var d = qvs.dclone(qpset.qps);
  res.json({status: "ok", data: qpset.qps});
}
// MYSQL_TYPE_...
var typemap_mysql = {
  "0":   "DECIMAL",
  "1":   "TINY",
  "2":   "SHORT",
  "3":   "LONG",
  "4":   "FLOAT",
  "5":   "DOUBLE",
  "6":   "NULL",
  "7":   "TIMESTAMP",
  "8":   "LONGLONG",
  "9":   "INT24",
  "10":  "DATE",
  "11":  "TIME",
  "12":  "DATETIME",
  "13":  "YEAR",
  "14":  "NEWDATE",
  "15":  "VARCHAR",
  "16":  "BIT",
  "246": "NEWDECIMAL",
  "247": "ENUM",
  "248": "SET",
  "249": "TINY_BLOB",
  "250": "MEDIUM_BLOB",
  "251": "LONG_BLOB",
  "252": "BLOB",
  "253": "VAR_STRING",
  "254": "STRING",
  "255": "GEOMETRY"
};

/**
* Note:
* TODO: Use async
*/
function tabinfo_load(conn, tabs) {
  // Lazy-load to not impose hard-dependency.
  //var async; async = require("async");
  //var
  tidx = {}; // Set stub
  if (!conn) { console.error("Need connection"); return; }
  if (!Array.isArray(tabs)) { console.error("Need tabs in array"); return; }
  function qtable(t, cb) {
    var qs = "SELECT * FROM "+t+" WHERE 0=1";
    console.log("Inquirying: "+t);
    var query = conn.query(qs,  function(err, result, flds) {
      if (err) { console.log("Error in query:"+qs+": "+err); return; } // cb(err, null)
      //console.log(flds);
      if (t.match(/\./)) {var narr = t.split(/\./); t = narr.pop(); } // ([])$
      
      for (var i=0;i < flds.length;i++) {
        flds[i].seq = i+1;
	flds[i].typestr = typemap_mysql[flds[i].type] || "???";
      }
      tidx[t] = flds;
      //if (debug > 1) { console.log("FLDS: "+ JSON.stringify(flds, null, 2)); }
      //return cb(null, flds);
    });
  }
  tabs.forEach((t) => { qtable(t); });
  //setTimeout(() => { console.log(tidx);}, 3000);
  // async.map(tabs, qtable, function (err, ress) {});
}
function tabinfo(req, res) {
  if (!tidx) { return res.json({ status:"err", "msg": "tabinfo not available !" }); }
  // Pre-transform ?
  var tabs = [];
  Object.keys(tidx).forEach((tn) => { tabs.push({name: tn, cols: tidx[tn]}); });
  res.json({status: "ok", data: tidx});
}
hdlrs.tabinfo = tabinfo;

// Turn values of one column into multiple columns in result set.
function vals2cols(req, res) {
  var jerr = { "status" : "err", "msg": "DB Search (distinct) failed. "};
  var q = req.query;
  var t = q.table;
  var a = q.attr;
  var qs = "SELECT DISTINCT("+a+") uni FROM "+t+"";
  var query = req.conn.query(qs,  function(err, result, flds) {
    if (err) { jerr.msg += err; res.json( jerr ); return; }
    //console.log(result);
    var vals = result.map((e) => { return e.uni; });
    var cont = "";
    var comps = [];
    vals.forEach((v) => {
      // TODO: Pad
      comps.push("SUM(case WHEN "+a+" = '"+v+"' THEN 1 END) AS t_"+a+"");
    });
    res.end();
  });

}
hdlrs.vals2cols = vals2cols;
/////////////////////////////////////////////////////
module.exports = {
  QueriedView: qv,
  QueriedViewSet: qvs,
  makeopts: makeopts,
  tabinfo_load: tabinfo_load,
  hdlrs: hdlrs
};
