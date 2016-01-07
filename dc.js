var parse = require("./lib/")();

parse.loadDirectory('./test/fixtures/dc.ss', function(err, result) {
	console.log(JSON.stringify(result, null, 2));
});
