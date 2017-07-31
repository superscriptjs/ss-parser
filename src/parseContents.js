import peg from 'pegjs';
import fs from 'fs';
import _ from 'lodash';
import async from 'async';
import lang from 'bot-lang';
import replace from 'async-replace';
import debuglog from 'debug';

import wordnet from './wordnet';

const debug = debuglog('ParseContents');

const grammar = fs.readFileSync(`${__dirname}/ss-grammar.pegjs`, 'utf-8');
// Change trace to true to debug peg
const parser = peg.generate(grammar, { trace: false });

const triggerGrammar = fs.readFileSync(`${__dirname}/trigger-grammar.pegjs`, 'utf-8');
const triggerParser = peg.generate(triggerGrammar, { trace: false });

const genId = function genId() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < 8; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const removeComments = function removeComments(code) {
  // Remove comments from script (e.g. // this is a comment)
  const lines = code.split('\n');
  let cleanedLines = lines.map((line) => {
    let index = line.indexOf('//');
    while (index !== -1) {
      if (line.charAt(index - 1) !== ':') {
        return line.substr(0, index);
      }
      index = line.indexOf('//', index + 2);
    }
    return line;
  });
  cleanedLines = cleanedLines.join('\n');
  // Multi-line comments
  cleanedLines = cleanedLines.replace(/\/\*(?:[\s\S]*?)\*\//g, '');
  return cleanedLines;
};

const removeEmptyLines = function removeEmptyLines(code) {
  // Removes any lines that contain just tabs and spaces and trim the rest
  const lines = code.split('\n');
  const cleanedLines = lines.map(line => line.trim())
                            .filter(line => line);
  return cleanedLines.join('\n');
};

const preprocess = function preprocess(code) {
  let cleanCode = removeComments(code);
  cleanCode = removeEmptyLines(cleanCode);
  // To avoid bespoke logic in the parser specifically checking the last set of topics/gambits,
  // just add a new line
  cleanCode = cleanCode.concat('\n');
  return cleanCode;
};

const expandWordnetTrigger = function expandWordnetTrigger(trigger, factSystem, callback) {
  const wordnetReplace = function wordnetReplace(match, word, p2, offset, done) {
    const wordnetLookup = () => wordnet.lookup(word, '~', (err, words) => {
      if (err) {
        console.log(err);
      }

      words = words.map(item => item.replace(/_/g, ' '));

      if (_.isEmpty(words)) {
        debug(`Creating a trigger with a concept not expanded: ${match}`);
        done(null, match);
      } else {
        words.push(word);
        words = `(?=^|\\s)\\s*(${words.join('|')})(?=\\s|$)\\s*`;
        done(null, words);
      }
    });

    // Use fact system first.
    if (factSystem) {
      return factSystem.conceptToList(word.toLowerCase(), (err, words) => {
        if (err) {
          console.log(err);
        }

        if (!_.isEmpty(words)) {
          words.push(word);
          words = `(?=^|\\s)\\s*(${words.join('|')})(?=\\s|$)\\s*`;
          done(null, words);
        } else {
          // Nothing found in fact system, use wordnet lookup.
          wordnetLookup();
        }
      });
    }

    // If no fact system, default to wordnet lookup.
    return wordnetLookup();
  };

  replace(trigger, /\s*~(\w+)\s*/g, wordnetReplace, callback);
};

const normalizeTrigger = function normalizeTrigger(trigger, factSystem, callback) {
  let cleanTrigger = lang.replace.all(trigger);
  cleanTrigger = triggerParser.parse(cleanTrigger).clean;
  expandWordnetTrigger(cleanTrigger, factSystem, (err, cleanTrigger) => {
    callback(err, cleanTrigger);
  });
};

const normalizeTriggers = function normalizeTriggers(data, factSystem, callback) {
  async.each(data.gambits, (gambit, nextGambit) => {
    if (gambit.trigger) {
      return normalizeTrigger(gambit.trigger.raw, factSystem, (err, cleanTrigger) => {
        gambit.trigger.clean = cleanTrigger;
        nextGambit();
      });
    }
    nextGambit();
  }, (err) => {
    callback(err, data);
  });
};

const collapseRandomGambits = function collapseRandomGambits(data) {
  const cleanData = _.clone(data);
  if (cleanData.gambits.length !== 0) {
    let randomTopic = cleanData.topics.find(topic => topic.name === 'random');
    if (!randomTopic) {
      cleanData.topics.push({
        name: 'random',
        flags: { keep: 'keep' },
        keywords: [],
        filter: null,
        gambits: [],
      });
      randomTopic = cleanData.topics.find(topic => topic.name === 'random');
    }
    cleanData.gambits.forEach((gambit) => {
      randomTopic.gambits.push(gambit);
    });
  }
  delete cleanData.gambits;
  return cleanData;
};

const splitGambitsAndReplies = function splitGambitsAndReplies(data) {
  // Moves gambits and replies into a top-level key
  const cleanData = _.clone(data);
  cleanData.replies = {};
  cleanData.gambits = {};
  cleanData.topics.forEach((topic) => {
    topic.gambits.forEach((gambit) => {
      // If it's a redirect, replies will be empty
      if (gambit.replies && gambit.replies.length !== 0) {
        gambit.replies = gambit.replies.map((reply) => {
          const replyId = genId();
          cleanData.replies[replyId] = reply;
          return replyId;
        });
      }
    });
    topic.gambits = topic.gambits.map((gambit) => {
      const gambitId = genId();
      cleanData.gambits[gambitId] = gambit;
      cleanData.gambits[gambitId].topic = topic.name;
      return gambitId;
    });
  });
  cleanData.topics = _.keyBy(cleanData.topics, 'name');
  return cleanData;
};

const processConversations = function processConversations(data) {
  const cleanData = _.clone(data);
  _.forEach(cleanData.gambits, (gambit) => {
    if (gambit.conversation !== null) {
      const repliesMatched = [];
      _.forEach(cleanData.replies, (reply, id) => {
        gambit.conversation = triggerParser.parse(gambit.conversation.raw);
        // Add punctuation at the end so can still match replies that have punctuation
        const pattern = new RegExp(`^${gambit.conversation.clean}\\s*[?!.]*$`, 'i');
        if (pattern.test(reply.string.replace(/\\n/g, ' '))) {
          repliesMatched.push(id);
        }
      });
      gambit.conversation = repliesMatched;
    }
  });
  return cleanData;
};

const postprocess = function postprocess(data, factSystem, callback) {
  let cleanData = collapseRandomGambits(data);
  cleanData = splitGambitsAndReplies(cleanData);
  cleanData = processConversations(cleanData);

  normalizeTriggers(cleanData, factSystem, callback);
};

const parseContents = function parseContents(code, factSystem, callback) {
  // Maintain backward compat.
  if (arguments.length === 2) {
    callback = factSystem;
    factSystem = {};
  }

  if (code.trim() === '') {
    return callback(null, {});
  }

  const preprocessed = preprocess(code);
  try {
    const parsed = parser.parse(preprocessed);
    postprocess(parsed, factSystem, (err, postprocessed) => {
      // Uncomment to debug the output of parseContents
      // fs.writeFileSync(`${__dirname}/../main.ss`, JSON.stringify(postprocessed, null, 2));
      callback(err, postprocessed);
    });
  } catch (e) {
    let errString = 'Error in parser\n';
    errString += `Found: ${e.found}\n`;
    errString += `Message: ${e.message}\n`;
    errString += `Line: '${preprocessed.split('\n')[e.location.start.line]}'`;
    callback(errString);
  }
};

export {
  normalizeTrigger,
  parseContents,
};
