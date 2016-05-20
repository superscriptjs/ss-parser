var Utils = require("./utils");
var wordnet = require("./wordnet");
var replace = require("async-replace");
var _ = require("lodash");
var debug = require("debug")("RegexReply");
var dWarn = require("debug")("RegexReply:Warning");

// Prepares a trigger for the regular expression engine.

var processAlternates = function (reply) {
  // input Alternates.

  var primary = reply.match(/(.?\(.+?\))/g);
  if (primary) {
    for (var n = 0; n < primary.length; n++) {
      // Filter out new Min, Max Wildcard Syntax
      if (primary[n][0] !== "*") {
        var match = primary[n].match(/\((.+?)\)/g);
        if (match) {
          for (var i = 0; i < match.length; i++) {
            var altGroup = match[i];
            var altMatch = altGroup.match(/\((.+?)\)/);

            var altStr = altMatch[1];
            var parts = altStr.split("|");

            var opts = [];
            for (var nn = 0; nn < parts.length; nn++) {
              opts.push(parts[nn].trim());
            }

            opts = "(\\b" + opts.join("\\b|\\b") + "\\b)\\s?";
            reply = reply.replace(altGroup, opts);
          }
        }
      }
    }
  }

  return reply;
};

exports.parse = function (regexp, facts, callback) {
  regexp = processAlternates(regexp);

  // If the trigger is simply '*' then the * needs to become (.*?)
  // to match the blank string too.
  regexp = regexp.replace(/^\*$/, "<zerowidthstar>");

  // Simple replacements.
  // This replacement must be done before the next or they will conflict.
  // * replacement is now optional by default meaning 0,n
  // Match Single * allowing *~n and *n to pass though
  // regexp = regexp.replace(/\s?\*(?!~?\d)\s?/g, "(?:.*\\s?)");  // Convert * into (.*)
  // Added new (min-max) - http://rubular.com/r/lW6FoLRxph
  regexp = regexp.replace(/\s?\*(?![~?\d\(])\s?/g, "(?:.*\\s?)");  // Convert * into (.*)

  // Step 1 nWidthStar
  // (\s?(?:[\w]*\s?){n})
  // Here we match *n where n is the number of words to allow
  // This provides much more flexibility around matching adverbs with nouns.
  // We deliberately slurp in the trailing space to support zero or more words
  var nWidthStarMatch = function (match, p1) {
    return "<" + parseInt(p1) + "ewidthstar>";
  };

  // Step 2 nWidthStar
  // (\s?(?:[\w]*\s?){0,n})
  var varWidthStarReplace = function (match, p1) {
    var num = parseInt(p1.replace("~", ""));
    return "<" + num + "vwidthstar>";
  };

  // Step 3 mix-maxWidthStar
  var mmWidthStarReplace = function (match, p1) {
    var parts = p1.split("-");
    if (parts.length === 2) {
      var v1 = parseInt(parts[0]);
      var v2 = parseInt(parts[1]);
      if (v1 === v2) {
        dWarn("MM Values are the same, dropping back to Variable Match");
        return "<" + v2 + "vwidthstar>";
      } else {
        return "<" + v1 + "," + v2 + "mmwidthstar>";
      }
    }
  };

  // Convert *n into multi word EXACT match
  regexp = regexp.replace(/\*([0-9]{1,2})/g, nWidthStarMatch);

  // Convert *(n) into multi word EXACT match
  regexp = regexp.replace(/\*\(([0-9]{1,2}\s?)\)/g, nWidthStarMatch);

  // Convert *~n into multi word VARIABLE match
  regexp = regexp.replace(/\s?\*(~[0-9]{1,2}\s?)/g, varWidthStarReplace);

  // Convert *(n-m) into multi word VARIABLE match
  regexp = regexp.replace(/\s*\*\((\d{1,2}\-\d{1,2}\s?)\)\s*/g, mmWidthStarReplace);
  regexp = regexp.replace(/<zerowidthstar>/g, "(?:.*?)");

  // Handle WordNet
  var wordnetReplace = function (match, sym, word, p3, offset, done) {
    // Use FactSystem first.

    facts.conceptToList(word.toLowerCase(), function (err, words) {
      if (err) {
        console.log(err);
      }

      if (!_.isEmpty(words)) {
        words = "(\\b" + words.join("\\b|\\b") + "\\b)";
        debug("Fact Replies", words);
        done(null, words);

      } else {
        wordnet.lookup(word, sym, function (err2, words) {
          if (err2) {
            console.log(err2);
          }

          // TODO add a space around the terms
          words = words.map(function (item) {
            return item.replace(/_/g, " ");
          });

          if (_.isEmpty(words)) {
            dWarn("Creating a trigger with a word NOT EXPANDED", match);
            done(null, match);
          } else {

            words = "(\\b" + words.join("\\b|\\b") + "\\b)";
            debug("Wordnet Replies", words);
            done(null, words);
          }
        });
      }
    });
  };

  replace(regexp, /(~)(\w[\w]+)/g, wordnetReplace, function (err, result) {
    if (err) {
      console.log(err);
    }

    regexp = result;

    // Optionals.
    var match = regexp.match(/\[(.+?)\]/);
    var giveup = 0;
    while (match) {
      giveup++;
      if (giveup >= 50) {
        dWarn("Infinite loop when trying to process optionals in trigger!");
        return "";
      }

      var parts = match[1].split("|");
      var opts = [];
      for (var i = 0; i < parts.length; i++) {
        var p = "\\s*" + parts[i] + "\\s*";
        opts.push(p);
      }

      opts.push("\\s*");

      // If this optional had a star or anything in it, make it non-matching.
      var pipes = opts.join("|");
      pipes = pipes.replace(new RegExp(Utils.quotemeta("(.+?)"), "g"), "(?:.+?)");
      pipes = pipes.replace(new RegExp(Utils.quotemeta("(\\d+?)"), "g"), "(?:\\d+?)");
      pipes = pipes.replace(new RegExp(Utils.quotemeta("([A-Za-z]+?)"), "g"), "(?:[A-Za-z]+?)");

      regexp = regexp.replace(new RegExp("\\s*\\[" + Utils.quotemeta(match[1]) + "\\]\\s*"),
        "(?:" + pipes + ")");
      match = regexp.match(/\[(.+?)\]/); // Circle of life!
    }

    // neWidthStar
    var exactWidthReplace = function(match2, p1) {
      return "(\\S+(?:\\s+\\S+){" + (parseInt(p1) - 1) + "})";
    };

    regexp = regexp.replace(/<(\d+)ewidthstar>/g, exactWidthReplace);

    // nvWidthStar
    var varWidthReplace = function (match3, p1) {
      return "\\s*(\\s?(?:[\\w-:]*\\??\\.?\\,?\\s*\\~?\\(?\\)?){0," + parseInt(p1) + "})";
    };

    regexp = regexp.replace(/<(\d+)vwidthstar>/g, varWidthReplace);

    // mmvWidthStar
    var mmWidthReplace = function (match4, p1, index) {
      var parts = p1.split(",");
      var min = parseInt(parts[0]);
      var max = parseInt(parts[1])
      var expression;
      if(min < 2) {
        expression = "\\s*((?:\\(?\\~?[\\w-:]+[\\?\\.\\'\\,\\s\\~\\)]*?)";
      } else {
        expression = "\\s*((?:\\(?\\~?[\\w-:]+[\\?\\.\\'\\,\\s\\~\\)]+[\\w-:]+[\\?\\.\\'\\,\\s\\~\\)]*?)";
      }
      return expression + "{" + min + "," + max + "})\\s?";
    };

    regexp = regexp.replace(/<(\d+,\d+)mmwidthstar>/g, mmWidthReplace);

    // We want to pad "* baz *" with word boundries
    var match = regexp.match(/^\(\?:\.\*\\s\?\)(.*)\(\?:\.\*\\s\?\)$/);
    if (match) {
      regexp = "(?:.*\\s?)\\b" + match[1] + "\\b(?:.*\\s?)";
    }

    callback(regexp);
  });
};

