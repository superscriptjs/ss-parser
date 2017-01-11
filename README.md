[![Build Status](https://travis-ci.org/superscriptjs/ss-parser.svg?branch=master)](https://travis-ci.org/superscriptjs/ss-parser)
[![Coverage Status](https://coveralls.io/repos/github/superscriptjs/ss-parser/badge.svg?branch=master)](https://coveralls.io/github/superscriptjs/ss-parser?branch=master)
[![Code Climate](https://codeclimate.com/github/superscriptjs/ss-parser/badges/gpa.svg)](https://codeclimate.com/github/superscriptjs/ss-parser)

# ss-parser

SuperScript parser is the interface for reading `*.ss` files and creating a internal representation for the SuperScript dialogue engine.

More information can be found at [superscriptjs.com](http://superscriptjs.com)

# API

* `parseDirectory(path, options, callback)`

Takes a directory path and parses all the `*.ss` files in the directory, creating a JSON structure which is passed into callback as `callback(err, results)`. The `options` parameter is an object that can accept a factSystem for use in trigger and reply expansion, and a cache to skip previously parsed files in a directory.

* `parseFile(path, factSystem, callback)`

Like `loadDirectory`, but parses a single `*.ss` file.

* `parseContents(path, factSystem, callback)`

Like `parseFile`, but parses a string (i.e. the contents of a single file).

* `normalizeTrigger(trigger, factSystem, callback)`

Takes a trigger string (for example, 'I like * and *~1, but not [cats|dogs].') and generates the regex for the trigger, which is passed into callback as `callback(err, cleanedTrigger)`.
