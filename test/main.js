var mocha = require("mocha");
var should = require("should");

var parse = require("../lib/")();

var findByTrigger = function(data, raw) {
  for (var gam in data.gambits) {
    if (data.gambits[gam].raw === raw) {
      return data.gambits[gam];
    }
  }
}

describe('Should Parse Input', function() {
  it("Should be an object", function (done) {
    parse.loadDirectory('./test/fixtures/main.ss', function(err, result) {

      // Should have the following keys
      ['topics', 'gambits', 'convos', 'replys', 'checksums'].should.eql(Object.keys(result));

      // We should have 4 topics
      ['random', '__pre__', '__post__', 'random2'].should.eql(Object.keys(result.topics));

      // We should have some gambits
      Object.keys(result.gambits).should.have.length(35);
      Object.keys(result.replys).should.have.length(36);

      // Lets make sure we have a conversations array as well
      var key = Object.keys(result.gambits).pop();
      result.gambits[key].options.conversations.should.have.length(3);
      findByTrigger(result, "this is in pre").topic.should.eql("__pre__");
      // console.log(result)

      done();
    });
  });
});
