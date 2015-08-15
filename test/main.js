var mocha = require("mocha");
var should = require("should");

var parse = require("../lib/")();

describe('Should Parse Input', function() {
  it("It should work", function (done) {

    parse.loadDirectory('./test/fixtures/main.ss', function(err, result) {
      console.log(err, result);
      done();
    });
  });
});
