var debug = require("debug")("Utils");
var fs = require("fs");
var _ = require("lodash");

// Strip all comments
var _stripComment = function (code) {
  var MULTILINE_COMMENT = /\/\*[^!][\s\S]*?\*\/\n/gm;
  var SINGLELINE_COMMENT = /^\s*\t*(\/\/)[^\n\r]*[\n\r]/gm;
  code = code.replace(MULTILINE_COMMENT, '');
  code = code.replace(SINGLELINE_COMMENT, '');
  return code;
};

exports._cleanRaw = function(code) {
  var codeNoComments = _stripComment(code);
  var lines = codeNoComments.split("\n");
  var cleanCode = _.map(lines, function(raw){
    return trim(raw);
  }).filter(function(line){ return line.length > 0; });

  return cleanCode;
};

// Strip whitespace from a string.
// We preserve new lines
exports.trim = trim = function (text) {
  var before = text;
  text = text || "";
  text = text.replace(/^[\s\t]+/i, "");
  text = text.replace(/[\s\t]+$/i, "");

  // text = text.replace(/[\x0D\x0A]+/, "");
  text = text.replace(/\s{2,}/g, " ");

  if (before !== text) {
    debug("Trim", text);
  }
  return text;
};

// Escape a string for a regexp.
exports.quotemeta = function (string, commands) {
  commands = commands || false;
  var unsafe = commands ? "\\.+?${}=!:" : "\\.+*?[^]$(){}=!<>|:";
  for (var i = 0; i < unsafe.length; i++) {
    string = string.replace(new RegExp("\\" + unsafe.charAt(i), "g"), "\\" + unsafe.charAt(i));
  }
  return string;
};


exports.genId = function () {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 8; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};


var walk = function (dir, done) {

  if (fs.statSync(dir).isFile()) {
    debug("Expected directory, found file, simulating directory with only one file: " + dir);
    return done(null, [dir]);
  }

  var results = [];
  fs.readdir(dir, function (err1, list) {
    if (err1) {
      return done(err1);
    }
    var pending = list.length;
    if (!pending) {
      return done(null, results);
    }
    list.forEach(function (file) {
      file = dir + "/" + file;
      fs.stat(file, function (err2, stat) {
        if (err2) {
          console.log(err2);
        }

        if (stat && stat.isDirectory()) {
          var cbf = function (err3, res) {
            results = results.concat(res);
            if (!--pending) {
              done(err3, results);
            }
          };

          walk(file, cbf);
        } else {
          results.push(file);
          if (!--pending) {
            done(null, results);
          }
        }
      });
    });
  });
};

exports.walk = walk;
