var mocha = require("mocha");
var should = require("should");

var parse = require("../lib/")();

describe('Should Parse Input', function() {
  it("Should be an object", function (done) {
    parse.loadDirectory('./test/fixtures/main.ss', function(err, result) {

      // Should have the following keys
      ['topics', 'gambits', 'replys', 'checksums'].should.eql(Object.keys(result));

      // We should have 2 topics
      ['random', 'random2'].should.eql(Object.keys(result.topics));

      // We should have some gambits
      Object.keys(result.gambits).should.have.length(27);
      Object.keys(result.replys).should.have.length(28);

      // Lets make sure we have a conversations array as well
      var key = Object.keys(result.gambits).pop();
      result.gambits[key].options.conversations.should.have.length(3);
      done();
      
    });
  });
});
