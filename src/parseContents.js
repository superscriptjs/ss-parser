import _ from 'lodash';
import async from 'async';
import norm from 'node-normalizer';
import debuglog from 'debug';

import regexreply from './regexReply';
import Utils from './utils';

const debug = debuglog('ParseContents');
const dWarn = debuglog('ParseContents:Warn');

const parseContents = function parseContents(code, factSystem, callback) {
  const FILTER_RE = /(\^\w+\([\w<>,\|\s]*\))/;
  let topicName = 'random'; // Initial Topic
  let currentTrigger = null;
  let currentCondition = null;
  let lineCursor = 0;
  const topics = {};
  let gambits = {};
  let conditions = {};
  const replies = {};
  let isConditional = false;
  let isMultilineConditional = false;
  let miniTopic = {
    line: null,
    isPrevious: null,
  };

  // initialise Random topic
  topics[topicName] = {
    flags: [],
    keywords: [],
  };

  const createWildCardGambit = function createWildCardGambit(topic) {
    const idTrigger = Utils.genId();
    const trigOptions = {
      isConditional: true,
      isQuestion: false,
      qType: false,
      qSubType: false,
      filter: false,
    };

    const gambit = Utils.initGambitTree(topic, idTrigger, '(?:.*?)', '*', trigOptions);
    currentTrigger = idTrigger;
    gambits = _.extend(gambits, gambit);
    return idTrigger;
  };

  const instructions = Utils.cleanRaw(code);
  const instructionsItor = function instructionsItor(raw, nextInstruction) {
    let line = raw;
    let cmd = null;
    lineCursor += 1;

    debug('--------------- NEW INSTRUCTION ---------------');
    debug('RAW:', line);

    const matchCommand = line.match(/^([+?\-%^<>@}]{1,2})(.*)/);
    if (matchCommand) {
      cmd = matchCommand[1];
      line = Utils.trim(matchCommand[2]);
    }

    debug('Cmd Extracted:', cmd);
    debug('Line Extracted:', line);

    // Reset the %Previous state if this is a new +Trigger.
    if (cmd === '+' || cmd === '?') {
      miniTopic.isPrevious = null;
    }

    // Do a lookahead for ^Continue and %Previous commands.
    miniTopic = Utils.searchMiniTopic(lineCursor, cmd, instructions);

    if (miniTopic.line !== null) {
      line += miniTopic.line;
    }

    switch (cmd) {
      case '?':
      case '+': {
        debug(`Trigger Found: ${line}`);
        debug('isPrevious: ', miniTopic);
        debug('IN TOPIC', topicName);
        line = norm.clean(line);

        let filterFunction = false;

        if (FILTER_RE.test(line)) {
          const m = line.match(FILTER_RE);
          filterFunction = m[1];
          line = Utils.trim(line.replace(m[1], ''));
        }

        let qSubType = false;
        let qType = false;

        // Here we are looking for qtypes after a colon
        const nextSym = line.substring(0, 1);
        if (nextSym === ':') {
          const sp = line.indexOf(' ');
          const cd = line.substring(0, sp);

          line = Utils.trim(line.substring(sp));
          const p = cd.split(':');
          const parts = [];
          for (let i = 0; i < p.length; i++) {
            if (p[i].length === 2) {
              qSubType = p[i];
            } else if (p[i] !== '') {
              parts.push(p[i]);
              qType = p[i];
            } else {
              qType = false;
            }
          }
          qType = (!_.isEmpty(parts)) ? parts.join(':') : false;
        }

        const trigOptions = {
          isQuestion: (cmd === '?'),
          isConditional,
          qType,
          qSubType,
          filter: filterFunction,
        };

        regexreply.parse(line, factSystem, (regexp) => {
          const idTrigger = Utils.genId();

          const done = () => {
            currentTrigger = idTrigger;
            nextInstruction();
          };

          if (miniTopic.isPrevious !== null) {
            debug("isPrevious found - in CMD '+'");

            regexreply.parse(miniTopic.isPrevious, factSystem, (prevParse) => {
              const pattern = new RegExp(prevParse, 'i');
              let convs = [];

              const itor = function (reply, id, cb) {
                if (pattern.test(reply) || miniTopic.isPrevious === reply) {
                  debug('Pushing Convo ID', id);
                  convs.push(id);
                }
                cb(null);
              };

              async.forEachOf(replies, itor, (err) => {
                convs = _.compact(convs);
                if (convs.length > 0) {
                  trigOptions.conversations = convs;
                }

                const gambit = Utils.initGambitTree(topicName, idTrigger, regexp, line, trigOptions);
                if (_.size(gambit) > 0) {
                  currentTrigger = idTrigger;
                  gambits = _.extend(gambits, gambit);
                }
                return done();
              });
            });
          } else {
            const gambit = Utils.initGambitTree(topicName, idTrigger, regexp, line, trigOptions);
            if (_.size(gambit) > 0) {
              currentTrigger = idTrigger;
              gambits = _.extend(gambits, gambit);
            }

            if (isConditional) {
              debug("isConditional found - in CMD '+'");
              conditions[currentCondition].gambits.push(currentTrigger);
              return done();
            }
            return done();
          }
        });
        break;
      }
      case '%%': {
        if (isMultilineConditional) {
          console.log('\n\n-------------- WARNING -------------');
          console.log('Error on line %s, already in a Conditional Block.', lineCursor);
          console.log('Conditional blocks can not be nested. Close it before opening a new one');
          console.log('>> %s', line);
          console.log('------------------------------------\n\n');
          return nextInstruction();
        }

        if (line.indexOf('{') !== -1) {
          isMultilineConditional = true;
        }

        const m = line.match(/\((.*)\)/i);
        const conditionId = Utils.genId();
        if (m) {
          const condition = {};
          condition[conditionId] = {
            topic: topicName,
            condition: m[1],
            gambits: [],
            raw: line,
          };

          // Reset the current trigger
          currentTrigger = null;
          conditions = _.extend(conditions, condition);
        }

        currentCondition = conditionId;
        isConditional = true;
        nextInstruction();
        break;
      }
      case '}': {
        isConditional = false;
        isMultilineConditional = false;
        nextInstruction();
        break;
      }
      case '-': {
        if (currentTrigger === null && !isConditional) {
          dWarn(`Response found before trigger: ${lineCursor}`);
          nextInstruction();
          break;
        } else if (currentTrigger === null && isConditional) {
          const gambitId = createWildCardGambit(topicName);
          conditions[currentCondition].gambits.push(gambitId);
        }

        debug(`Response: ${line}`);
        const idTrigger = Utils.genId();
        replies[idTrigger] = line;
        gambits[currentTrigger].replies.push(idTrigger);

        // Reset Conditional
        if (!isMultilineConditional && isConditional) {
          isConditional = false;
        }

        nextInstruction();
        break;
      }
      case '@': {
        if (currentTrigger === null) {
          dWarn(`Response found before trigger: ${lineCursor}`);
          nextInstruction();
          break;
        }
        debug(`Redirect response to: ${line}`);

        gambits[currentTrigger].redirect = Utils.trim(line);
        nextInstruction();
        break;
      }
      case '>': {
        // > LABEL
        // Strip off Keywords and functions
        let m = [];
        let keywords = [];
        let filterFunction = false;

        if (FILTER_RE.test(line)) {
          m = line.match(FILTER_RE);
          filterFunction = m[1];
          line = line.replace(m[1], '');
        }

        const KEYWORD_RE = /(\([\w\s~]*\))/;
        if (KEYWORD_RE.test(line)) {
          m = line.match(KEYWORD_RE);
          keywords = m[1].replace('(', '').replace(')', '').split(' ');
          keywords = keywords.filter(i => i);
          line = line.replace(m[1], '');
        }

        const temp = Utils.trim(line).split(' ');
        let type = temp.shift();
        let flags = type.split(':');

        if (flags.length > 0) type = flags.shift();
        debug(`line: ${line}; temp: ${temp}; type: ${type}; flags: ${flags} keywords: ${keywords}`);

        let name = '';
        if (temp.length > 0) name = temp.shift();

        // Handle the label types. pre and post
        if (type === 'pre' || type === 'post') {
          debug(`Found the ${type} block.`);
          name = `__${type}__`;
          type = 'topic';

          if (!topics[name]) {
            topics[name] = { flags: [], keywords: [] };
          }

          topics[name].filter = (filterFunction) ? filterFunction : null;
          topics[name].flags.push('keep');
          topicName = name;
        } else if (type === 'topic') {
          if (!topics[name]) {
            topics[name] = { flags: [], keywords: [] };
          }

          topics[name].filter = (filterFunction) ? filterFunction : null;
          for (let i = 0; i < keywords.length; i++) {
            topics[name].keywords.push(keywords[i]);
          }

          // Starting a new topic.
          debug(`Set topic to ${name}`);
          currentTrigger = null;
          topicName = name;

          if (_.isArray(flags) && flags.length === 1) {
            flags = _.first(flags);
            flags = flags.split(',');
          }

          topics[name].flags = topics[name].flags.concat(flags);
        } else {
          dWarn(`Unknown topic type: '${type}' at ${lineCursor}`);
        }
        nextInstruction();
        break;
      }
      case '<': {
        // < LABEL
        if (line === 'topic' || line === 'post' || line === 'pre') {
          debug('End the topic label.');
          // Reset the topic back to random
          topicName = 'random';
        }
        nextInstruction();
        break;
      }
      case '%': nextInstruction(); break;
      case '^': nextInstruction(); break;
      default:
        dWarn('Unknown Command:', cmd, 'at', lineCursor);
        nextInstruction();
        break;
    }
  };

  debug(`Number of instructions: ${instructions.length}`);
  async.eachSeries(instructions, instructionsItor, () => {
    const data = {
      topics,
      gambits,
      conditions,
      replies,
    };
    callback(null, data);
  });
};

export default parseContents;
