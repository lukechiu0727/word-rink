// Google Apps Script for the study apps (Word Rink, Word Pitch, Word Prep, Number Rink, Math Prep, Math Pitch).
// Does three jobs: (1) parent-report rows in the "log" sheet, (2) restore-from-sheet,
// (3) live progress sync across devices, kept in the "sync" sheet (one row per app + name).
//
// Install / update:
//   Extensions > Apps Script in your Google Sheet, paste this whole file over the old one, save.
//   Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy   (the URL stays the same)
//   First time only: Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone.
// Optional: put a password in SECRET and the same password in each app's Setup > "Sheet password".
const SECRET = "";

// Merge two packed progress states. Same code runs in the apps and in the Apps Script.
// Per item: keep the record with more attempts (right + wrong); attempts only ever go up, so nothing learned is lost.
// Settings: newer device wins. XP / best streak: max. Badges: union. Daily history: max per field.
// A reset bumps "epoch"; a newer epoch replaces everything older.
function mergePacked(a,b){if(!a)return b;if(!b)return a;
  if((a.epoch||0)!==(b.epoch||0))return (a.epoch||0)>(b.epoch||0)?a:b;
  var newer=(a.updated||0)>=(b.updated||0)?a:b,older=newer===a?b:a,o={},k;
  for(k in older)o[k]=older[k];for(k in newer)o[k]=newer[k];
  var m={};function put(r){var c=m[r[0]];if(!c){m[r[0]]=r;return}var ta=(c[3]||0)+(c[4]||0),tb=(r[3]||0)+(r[4]||0);if(tb>ta||(tb===ta&&(r[2]||0)>(c[2]||0)))m[r[0]]=r}
  (older.W||[]).forEach(put);(newer.W||[]).forEach(put);o.W=Object.keys(m).map(function(x){return m[x]});
  o.xp=Math.max(a.xp||0,b.xp||0);o.best=Math.max(a.best||0,b.best||0);
  var st=(a.last||"")>=(b.last||"")?a:b;o.streak=st.streak||0;o.last=st.last||"";o.freezeUsed=st.freezeUsed||"";
  var bs={};(a.badges||[]).concat(b.badges||[]).forEach(function(x){bs[x]=1});o.badges=Object.keys(bs);
  o.hist={};[a.hist||{},b.hist||{}].forEach(function(h){Object.keys(h).forEach(function(d){var x=o.hist[d]||(o.hist[d]={});Object.keys(h[d]).forEach(function(f){x[f]=Math.max(x[f]||0,h[d][f]||0)})})});
  if(a.check||b.check){o.check={};var ca=older.check||{},cb=newer.check||{};for(k in ca)o.check[k]=ca[k];for(k in cb)o.check[k]=cb[k]}
  if(a.placed||b.placed)o.placed=true;
  o.ik=(a.ik==="n"||b.ik==="n")?"n":(newer.ik||older.ik||"s");
  o.updated=Math.max(a.updated||0,b.updated||0);return o}

function clean(v) { return (typeof v === "string" && /^[=+\-@]/.test(v)) ? "'" + v : v; }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function logSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("log") || ss.insertSheet("log");
  var hdr = ["received", "date", "name", "streak", "xp", "mastered", "seen", "total", "due",
             "today questions", "today accuracy %", "today new", "today xp", "weak items (misses)", "backup code", "app"];
  if (sh.getLastRow() === 0) { sh.appendRow(hdr); sh.setFrozenRows(1); }
  else if (sh.getRange(1, 16).getValue() === "") { sh.getRange(1, 16).setValue("app"); }
  return sh;
}
function syncSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("sync");
  if (!sh) { sh = ss.insertSheet("sync"); sh.appendRow(["key", "app", "name", "last change", "state"]); sh.setFrozenRows(1); }
  return sh;
}
function decodeState(s) { return JSON.parse(Utilities.newBlob(Utilities.base64Decode(String(s).replace(/^'/, "").slice(3))).getDataAsString("UTF-8")); }
function encodeState(o) {
  var s = "z1." + Utilities.base64Encode(JSON.stringify(o), Utilities.Charset.UTF_8);
  if (s.length > 48000) { o.hist = {}; s = "z1." + Utilities.base64Encode(JSON.stringify(o), Utilities.Charset.UTF_8); }
  return s;
}
function syncKey(app, name) { return String(app) + "|" + String(name).trim().toLowerCase(); }
function findSyncRow(sh, key) {
  var n = sh.getLastRow(); if (n < 2) return -1;
  var keys = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) if (keys[i][0] === key) return i + 2;
  return -1;
}

function doPost(e) {
  var d = JSON.parse(e.postData.contents);
  if (SECRET && d.token !== SECRET) return json({ ok: false, error: "denied" });
  if (d.op === "sync") {
    if (!d.app || !d.name || !d.state) return json({ ok: false, error: "bad request" });
    var lock = LockService.getScriptLock(); lock.waitLock(15000);
    try {
      var sh = syncSheet(), key = syncKey(d.app, d.name), row = findSyncRow(sh, key);
      var incoming = decodeState(d.state), merged = incoming;
      if (row > 0) { try { merged = mergePacked(decodeState(sh.getRange(row, 5).getValue()), incoming); } catch (err) {} }
      var vals = [[key, d.app, d.name, new Date(merged.updated || Date.now()), encodeState(merged)]];
      if (row > 0) sh.getRange(row, 1, 1, 5).setValues(vals); else sh.appendRow(vals[0]);
    } finally { lock.releaseLock(); }
    return json({ ok: true });
  }
  logSheet().appendRow([new Date(), d.date, d.name, d.streak, d.xp, d.mastered, d.seen, d.total, d.due,
                        d.todayQ, d.todayAcc, d.todayNew, d.todayXP, d.weak, d.backup, d.app || ""].map(clean));
  return json({ ok: true });
}

// GET ?op=pull&name=...&app=...  -> synced state for that name in that app
// GET ?name=...&app=...          -> latest backup from the report log (restore)
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!p.name || !p.app) return ContentService.createTextOutput("Report endpoint is live.");
  if (SECRET && p.token !== SECRET) return json({ found: false, error: "denied" });
  if (p.op === "pull") {
    var sh = syncSheet(), row = findSyncRow(sh, syncKey(p.app, p.name));
    if (row < 0) return json({ found: false });
    return json({ found: true, state: String(sh.getRange(row, 5).getValue()).replace(/^'/, "") });
  }
  var vals = logSheet().getDataRange().getValues();
  var h = vals[0], ni = h.indexOf("name"), bi = h.indexOf("backup code"), ai = h.indexOf("app"), ri = h.indexOf("received");
  var want = String(p.name).trim().toLowerCase();
  for (var i = vals.length - 1; i >= 1; i--) {
    var r = vals[i];
    if (String(r[ni]).trim().toLowerCase() === want && String(r[ai]) === p.app && r[bi]) {
      var when = r[ri] instanceof Date ? Utilities.formatDate(r[ri], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm") : String(r[ri]);
      return json({ found: true, received: when, backup: String(r[bi]).replace(/^'/, "") });
    }
  }
  return json({ found: false });
}
