// Lets actually test this thing
var mocha = require("mocha");
var should = require("should");
var debug = require("debug")("suite");
var rxreply = require("../lib/regexreply");
var async = require("async");
var _ = require("lodash");

var test = [
  {test: "hello", input: "hello"},
  {test: "__define_flow__", input: "*"},

  // Simple wildcard
  {test: "hello", input: "*", matches: ["hello"]},
  {test: "hello world", input: "*", matches: ["hello world"]},
  {test: "hello *", input: "hello *"},
  // Variable Length Wildcards
  {test: "hello world", input: "hello *~1", matches: ["world"]},
  {test: "hello world", input: "hello *~5"},
  {test: "hello world", input: "hello world *~1"},
  {test: "hello world", input: "hello *~1 world"},
  {test: "hello world", input: "*~1 world"},
  // Exact Length Wildcards
  {test: "hello world", input: "hello *1", matches: ["world"]},
  {test: "hello world", input: "hello world *1", assert: false},
  {test: "hello world", input: "*3", assert: false},
  {test: "hello world", input: "*2"},
  // Min Max

  {test: "who is on Brandon's team", input: "who is on *(1-3) team",},
  {test: "hello world", input: "*(0-2)", matches: ["hello world"]},
  {test: "hello world", input: "*(1-3)"},
  {test: "hello", input: "*(2-5)", assert: false},
  {test: "x is related to y", input: "*(1-5) is related to *(1-5)", matches: ["x", "y"]},
  {test: "hello world", input: "*(1-5) world"}, // leading
  {test: "hello world", input: "hello *(1-5)"}, // trailing
  {test: "hello world", input: "hello *(0-2)"},
  {test: "hello world", input: "*(1-2) world *(0-3)"},
  {test: "hello world boo bar baz buzz bob", input: "*(1-2) world *(0-3)", assert: false},
  {test: "hello world", input: "*(1-2) world *(1-3)", assert: false},
  {test: "~emohello world", input: "*(1-2) world"},
  {test: "world ~emohello", input: "world *(1-2)"},
  {test: "a b c d:e f", input: "a *(2-10)"},

  // Alternates
  {test: "bar", input: "(bar|baz)"},
  {test: "baz", input: "(bar|baz)"},
  {test: "a b d", input: "a (b|c) d"},
  
  // Optional
  {test: "foo bar baz", input: "foo [bar] baz"},
  {test: "foo bar baz", input: "foo [bar] [baz] [buz]"},
  {test: "foo bar baz", input: "foo [bar|baz] [buz]", assert: false},
  
  // Advanced
  {test: "fine", input: "[*] (fine|good) [*]"},
  {test: "ok fine", input: "[*] (fine|good) [*]"},
  {test: "sure fine okay", input: "[*] (fine|good) [*]"},

  {test: "please help me", input: "* help *"},
  {test: "please help me", input: "* (help) *"},
  {test: "pleasehelpme", input: "* help *", assert: false},
  {test: "favorite", input: "* (or) *", assert: false},
  {test: "baz b foo", input: "*(1-2) (a|b) *(1-2)"},
  {test: "baz b foo bar", input: "*(1-2) (a|b) *(1-2)"},
  {test: "baz b foo bar", input: "*~2 (a|b) *~2"},

  {test: "foo is awesome", input: "*(1-3) is (*)"},
  {test: "foo is", input: "*(1-3) is (*)", assert: false},
  {test: "is awesome", input: "*(1-3) is (*)", assert: false},

  {test: "Is there a way to enjoy running outside in this awful Toronto cold weather? (-17 Celsius with wind chill)", input: "*(2-99)"},
  {test: "Is there a way to enjoy running outside in this awful Toronto cold weather? (-17 Celsius with wind chill)", input: "*~99"},
];

describe("Regex Reply Parse", function() {

  var itor = function(item, next) {
    it("Test '" + item.test + "' '" + item.input + "' should be " + (item.assert === false ?  "false" : "true"), function(done){
      rxreply.parse(item.input, {}, function(regexp) {
        debug(regexp);
        var pattern = new RegExp("^" + regexp + "$", "i");

        if (item.assert === false) {
          pattern.test(item.test).should.be.false();
        } else {
          pattern.test(item.test).should.be.true();
        }

        if (item.matches) {
          var matches = item.test.match(pattern);
          if (matches) {
            matches.should.containDeep(item.matches);
          }

        }

        done();
        next();
      });
    });
  }

  async.each(test, itor, function() {
    console.log("Done")
  });
});


