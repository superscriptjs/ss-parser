var mocha = require("mocha");
var should = require("should");
var wordnet = require("../lib/wordnet");

describe('Wordnet', function() {
  it("Should define a word.", function (done) {
    wordnet.define("sit", function(err, results){
      should.not.exist(err);
      results.should.not.be.empty;
      done();
    });
  });
  it("Should explore a word.", function (done) {
    wordnet.explore("sit", function(err, results){
      should.not.exist(err);
      done();
    });
  });
});
