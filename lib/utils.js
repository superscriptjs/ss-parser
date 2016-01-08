var debug = require("debug")("Utils");
var dSearchMiniTopic = require("debug")("ParseContents:_searchMiniTopic");
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

exports._searchMiniTopic = function(cursor, cmd, instructions) {
  var result = {
    line: null,
    isPrevious: null
  };

  for (var i = cursor; i < instructions.length; i++) {
    var lookahead = trim(instructions[i]);
    if (lookahead.length < 2) continue;

    var matchCommand = lookahead.match(/^([+\?\-\%^\<\>\@]{1,2})(.*)/);
    if (matchCommand) {
      lookCmd = matchCommand[1];
      lookahead = trim(matchCommand[2]);
    }

    dSearchMiniTopic('_searchMiniTopic - Process line:', instructions[i]);
    dSearchMiniTopic('_searchMiniTopic - lookCmd:', lookCmd, '(', cmd, ')');
    dSearchMiniTopic('_searchMiniTopic - lookahead: ' + lookahead);
    
    // Only continue if the lookahead line has any data.
    if (lookahead.length !== 0) {
      // If the current command is a +, see if the following is a %.
      if (cmd === "+" || cmd === "?") {
        if (lookCmd === "%") {
          dSearchMiniTopic('_searchMiniTopic: Setting isPrevious');
          result.isPrevious = lookahead;
          break;
        } else {
          result.isPrevious = null;
        }
      }

      // If the current command is not a ^, and the line after is
      // not a %, but the line after IS a ^, then tack it on to the
      // end of the current line.
      if (cmd !== "^" && lookCmd !== "%") {
        if (lookCmd === "^") {
          result.line = (result.line === null) ? lookahead : result.line + lookahead;
        } else {
          break;
        }
      }
    }
  }
  return result;
};

exports._initGambitTree = function (topicName, idTrigger, regexp, raw, options) {

  var gambit = {};

  gambit[idTrigger] = {
    topic: topicName,
    options: options,
    replys: [],
    redirect: null,
    trigger: regexp
  };

  if (options.isCondition) {
    gambit[idTrigger].condition = options.isCondition;
  }

  if(raw !== null) {
    gambit[idTrigger].raw = raw;
  }

  return gambit;
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
