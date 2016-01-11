var Utils = require("./utils");
var async = require("async");
var regexreply = require("./regexreply");
var debug = require("debug")("ParseContents");
var dWarn = require("debug")("ParseContents:Warn");

var _ = require("lodash");

module.exports = function(norm) {
  return function(code, factSystem, callback) {

    var KEYWORD_RE = /(\([\w\s~]*\))/;
    var FILTER_RE = /(\^\w+\([\w<>,\|\s]*\))/;
    var root = this;
    var comment = false;
    var topicName = "random";   // Initial Topic
    var currentTrigger = null;  // The current trigger
    var lastCmd = null;         // Last command code
    var lineCursor = 0;
    var topics = {};
    var gambits = {};
    var convos = {};
    var replys = {};
    var idTrigger;
    var isConditional  = false;
    var isMultilineConditional = false;
    var miniTopic = {
      line: null,
      isPrevious: null
    };

    //initialise Random topic
    topics[topicName] = {
      flags: [],
      keywords: []
    };

    var createWildCardGambit = function(topic) {
      var idTrigger = Utils.genId();
      var trigOptions = {
        isConditional: true,
        isQuestion: false,
        qType : false,
        qSubType : false,
        filter: false
      };

      gambit = Utils._initGambitTree(topic, idTrigger, "(?:.*?)", "*", trigOptions);
      currentTrigger = idTrigger;
      gambits = _.extend(gambits, gambit);
      return idTrigger;
    }

    var instructions = Utils._cleanRaw(code);
    var instructionsItor = function(raw, nextInstruction) {
      var line = raw;
      var cmd = null;
      lineCursor++;
      
      debug("--------------- NEW INSTRUCTION ---------------")
      debug("RAW:", line);

      var matchCommand = line.match(/^([+\?\-\%^\<\>\@\}]{1,2})(.*)/);
      if (matchCommand) {
        cmd = matchCommand[1];
        line = Utils.trim(matchCommand[2]);
      }

      debug('Cmd Extracted:',cmd);
      debug('Line Extracted:',line);

      // Reset the %Previous state if this is a new +Trigger.
      if (cmd === "+" || cmd === "?") {
        miniTopic.isPrevious = null;
      }

      // Do a lookahead for ^Continue and %Previous commands.
      miniTopic = Utils._searchMiniTopic(lineCursor, cmd, instructions);

      if (miniTopic.line !== null) {
        line += miniTopic.line;
      }

      switch(cmd) {
        case "?":
        case "+":
          debug('Trigger Found: ' + line);
          debug('isPrevious: ', miniTopic);
          debug("IN TOPIC", topicName);
          line = norm.clean(line);

          var idTrigger = Utils.genId();
          var qSubType = false;
          var qType = false;
          var filterFunction = false;

          if (FILTER_RE.test(line)) {
            m = line.match(FILTER_RE);
            filterFunction = m[1];
            line = Utils.trim(line.replace(m[1], ""));
          }

          // Here we are looking for qtypes after a colon
          var nextSym = line.substring(0,1);
          if (nextSym === ":") {
            var sp = line.indexOf(" ");
            var cd = line.substring(0, sp);

            line = Utils.trim(line.substring(sp));
            var p = cd.split(":");
            var parts = [];
            for (var i = 0; i < p.length; i++) {
              if (p[i].length == 2) {
                qSubType = p[i];
              } else {
                if (p[i] !== "") {
                  parts.push(p[i]);
                  qType = p[i];
                } else {
                  qType = false;
                }
              }
            }
            qType = (!_.isEmpty(parts)) ? parts.join(":") : false;
          }

          var trigOptions = {
            isQuestion: (cmd === "?") ? true : false,
            qType : qType,
            isConditional: (isConditional) ? true : false,
            qSubType : qSubType,
            filter: filterFunction
          };

          regexreply.parse(line, factSystem, function(regexp) {
            var done = function () {
              currentTrigger = idTrigger;
              nextInstruction();
            };

            var topic;
            if (miniTopic.isPrevious !== null) {
              debug("isPrevious found - in CMD '+'");

              regexreply.parse(miniTopic.isPrevious, factSystem, function(prevParse) {
                var pattern = new RegExp(prevParse, "i");
                var convs = [];

                var itor = function(reply, id, cb) {
                  if (pattern.test(reply) || miniTopic.isPrevious === reply) {
                    debug("Pushing Convo ID", id)
                    convs.push(id);
                  }
                  cb(null);
                };

                async.forEachOf(replys, itor, function(err) {
                  convs = _.compact(convs);
                  if (convs.length > 0) {
                    trigOptions.conversations = convs;
                  }

                  gambit = Utils._initGambitTree(topicName, idTrigger, regexp, line, trigOptions);
                  if(_.size(gambit) > 0) {
                    currentTrigger = idTrigger;
                    gambits = _.extend(gambits, gambit);
                  }
                  return done();
                });
              });

            } else {

              gambit = Utils._initGambitTree(topicName, idTrigger, regexp, line, trigOptions);
              if(_.size(gambit) > 0) {
                currentTrigger = idTrigger;
                gambits = _.extend(gambits, gambit);
              }

              if (isConditional) {
                debug("isConditional found - in CMD '+'");

                for(con in convos) {
                  if (con === isConditional) {
                    convos[con].gambits.push(currentTrigger)
                  }
                }
                return done();
              } else {
                return done();
              }
            }
          });

          break;
        case "%%":

            if (isMultilineConditional) {
              console.log("\n\n-------------- WARNING -------------");
              console.log("Error on line %s, already in a Conditional Block.", lineCursor);
              console.log("Conditional blocks can not be nested. Close it before opening a new one")
              console.log(">> %s", line);
              console.log("------------------------------------\n\n");
              return nextInstruction();
            }

            if (line.indexOf("{") !== -1) {
              isMultilineConditional = true;
            }

            var m = line.match(/\((.*)\)/i);
            if (m) {
              var idTrigger = Utils.genId();
              var con = {};

              con[idTrigger] = {
                topic: topicName,
                condition: m[1],
                gambits: [],
                raw: line
              };

              // Reset the current trigger
              currentTrigger = null;
              convos = _.extend(convos, con);
            }
            
            isConditional = idTrigger;
            nextInstruction();
          break;
        case "}":
            isConditional = false;
            isMultilineConditional = false;
            nextInstruction();
          break;
        case "-":
          if (currentTrigger === null && !isConditional) {
            dWarn('Response found before trigger: ' + lineCursor);
            nextInstruction();
            break;
          } else if (currentTrigger === null && isConditional) {
            var gambitId = createWildCardGambit(topicName);
            for(con in convos) {
              if (con === isConditional) {
                convos[con].gambits.push(gambitId)
              }
            }
          }

          debug('Response: ' + line);
          idTrigger = Utils.genId();
          replys[idTrigger] = line;
          gambits[currentTrigger].replys.push(idTrigger);

          // Reset Conditional 
          if (isMultilineConditional === false && isConditional) {
            isConditional = false;
          }

          nextInstruction();
          break;
        case '@':
          if (currentTrigger === null) {
            dWarn('Response found before trigger: ' + lineCursor);
            nextInstruction();
            break;
          }
          debug("Redirect response to: " + line);

          gambits[currentTrigger].redirect = Utils.trim(line);
          nextInstruction();
          break;
        case '>':
          // > LABEL
          // Strip off Keywords and functions
          var m = [];
          var keywords = [];
          var filterFunction = false;

          if (FILTER_RE.test(line)) {
            m = line.match(FILTER_RE);
            filterFunction = m[1];
            line = line.replace(m[1], "");
          }

          if (KEYWORD_RE.test(line)) {
            m = line.match(KEYWORD_RE);
            keywords = m[1].replace("(","").replace(")","").split(" ");
            keywords = keywords.filter(function(i){return i;});
            line = line.replace(m[1], "");
          }

          var temp   = Utils.trim(line).split(" ");
          var type   = temp.shift();
          var flags  = type.split(":");

          if (flags.length > 0)  type = flags.shift();
          debug("line: " + line + "; temp: " + temp + "; type: " + type + "; flags: " + flags + " keywords: " + keywords);

          var name   = '';
          if (temp.length > 0)  name = temp.shift();

          // Handle the label types. pre and post
          if (type === "pre" || type === "post") {
            debug("Found the " + type + " block.");
            name = "__" + type + "__";
            type = "topic";
            
            if (!topics[name]) {
              topics[name] = {flags:[], keywords: []};
            }

            topics[name].filter = (filterFunction) ? filterFunction : null;
            topics[name].flags.push('keep');
            topicName  = name;

          } else if (type === "topic") {

            if(!topics[name]) {
              topics[name] = {flags:[], keywords: []};
            }

            topics[name].filter = (filterFunction) ? filterFunction : null;
            for (var i = 0; i < keywords.length; i++) {
              topics[name].keywords.push(keywords[i]);
            }

            // Starting a new topic.
            debug("Set topic to " + name);
            currentTrigger = null;
            topicName  = name;

            if(_.isArray(flags) && flags.length === 1) {
              flags = _.first(flags);
              flags = flags.split(',');
            }

            topics[name].flags = topics[name].flags.concat(flags);
          } else {
            dWarn('Unknown topic type: \'' + type + '\' at ' + lineCursor);
          }
          nextInstruction();
          break;
        case '<':
          // < LABEL
          if (line === "topic" || line === "post" || line === "pre") {
            debug("End the topic label.");
            // Reset the topic back to random
            topicName = "random";
          }
          nextInstruction();
          break;
        case '%': nextInstruction(); break;
        case '^': nextInstruction(); break;
        default:
          dWarn('Unknown Command:', cmd, 'at', lineCursor);
          nextInstruction();
          break;
      }
    };

    debug('Number of instructions: ' + instructions.length);
    async.eachSeries(instructions, instructionsItor, function(){
      var data = {
        topics: topics,
        gambits: gambits,
        convos: convos,
        replys: replys
      };
      callback(null, data);
    });

  };
};
