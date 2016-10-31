import fs from 'fs';
import _ from 'lodash';
import debuglog from 'debug';

const debug = debuglog('Utils');
const dSearchMiniTopic = debuglog('ParseContents:searchMiniTopic');

// Strip whitespace from a string. We preserve new lines.
const trim = function trim(text = '') {
  const before = text;
  text = text.replace(/^[\s\t]+/i, '');
  text = text.replace(/[\s\t]+$/i, '');

  // text = text.replace(/[\x0D\x0A]+/, "");
  text = text.replace(/\s{2,}/g, ' ');

  if (before !== text) {
    debug('Trim', text);
  }
  return text;
};

// Strip all comments
const stripComment = function stripComment(code = '') {
  const MULTILINE_COMMENT = /\/\*[^!][\s\S]*?\*\/\n/gm;
  const SINGLELINE_COMMENT = /^\s*\t*(\/\/)[^\n\r]*[\n\r]/gm;
  code = code.replace(MULTILINE_COMMENT, '');
  code = code.replace(SINGLELINE_COMMENT, '');
  return code;
};

const searchMiniTopic = function searchMiniTopic(cursor, cmd, instructions) {
  let lookCmd;
  const result = {
    line: null,
    isPrevious: null,
  };

  for (let i = cursor; i < instructions.length; i++) {
    let lookahead = trim(instructions[i]);
    if (lookahead.length < 2) {
      continue;
    }

    const matchCommand = lookahead.match(/^([+\?\-\%^\<\>\@]{1,2})(.*)/);
    if (matchCommand) {
      lookCmd = matchCommand[1];
      lookahead = trim(matchCommand[2]);
    }

    dSearchMiniTopic('searchMiniTopic - Process line:', instructions[i]);
    dSearchMiniTopic('searchMiniTopic - lookCmd:', lookCmd, '(', cmd, ')');
    dSearchMiniTopic('searchMiniTopic - lookahead:', lookahead);

    // Only continue if the lookahead line has any data.
    if (lookahead.length !== 0) {
      // If the current command is a +, see if the following is a %.
      if (cmd === '+' || cmd === '?') {
        if (lookCmd === '%') {
          dSearchMiniTopic('_searchMiniTopic: Setting isPrevious');
          result.isPrevious = lookahead;
          break;
        } else {
          result.isPrevious = null;
        }
      }

      // If the current command is not a ^, and the line after is
      // not a %, but the line after IS a ^, then tack it on to the
      // end of the current line.
      if (cmd !== '^' && lookCmd !== '%') {
        if (lookCmd === '^') {
          result.line = result.line === null ? lookahead : result.line + lookahead;
        } else {
          break;
        }
      }
    }
  }
  return result;
};

const initGambitTree = function initGambitTree(topicName, idTrigger, regexp, raw, options) {
  const gambit = {};

  gambit[idTrigger] = {
    topic: topicName,
    options,
    replies: [],
    redirect: null,
    trigger: regexp,
  };

  if (options.isCondition) {
    gambit[idTrigger].condition = options.isCondition;
  }

  if (raw !== null) {
    gambit[idTrigger].raw = raw;
  }

  return gambit;
};

const cleanRaw = function cleanRaw(code) {
  const codeNoComments = stripComment(code);
  const lines = codeNoComments.split('\n');
  const cleanCode = _.map(lines, raw =>
     trim(raw)
  ).filter(line =>
     line.length > 0
  );

  return cleanCode;
};

// Escape a string for a regexp.
const quotemeta = function quotemeta(string, commands = false) {
  const unsafe = commands ? '\\.+?${}=!:' : '\\.+*?[^]$(){}=!<>|:';
  for (let i = 0; i < unsafe.length; i++) {
    string = string.replace(new RegExp(`\\${unsafe.charAt(i)}`, 'g'), `\\${unsafe.charAt(i)}`);
  }
  return string;
};


const genId = function genId() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < 8; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const walk = function walk(dir, done) {
  if (fs.statSync(dir).isFile()) {
    debug(`Expected directory, found file, simulating directory with only one file: ${dir}`);
    return done(null, [dir]);
  }

  let results = [];
  fs.readdir(dir, (err1, list) => {
    if (err1) {
      return done(err1);
    }
    let pending = list.length;
    if (!pending) {
      return done(null, results);
    }
    list.forEach((file) => {
      file = `${dir}/${file}`;
      fs.stat(file, (err2, stat) => {
        if (err2) {
          console.error(err2);
        }

        if (stat && stat.isDirectory()) {
          const cbf = (err3, res) => {
            results = results.concat(res);
            pending -= 1;
            if (!pending) {
              done(err3, results);
            }
          };

          walk(file, cbf);
        } else {
          results.push(file);
          pending -= 1;
          if (!pending) {
            done(null, results);
          }
        }
      });
    });
  });
};

export default {
  cleanRaw,
  genId,
  initGambitTree,
  quotemeta,
  searchMiniTopic,
  trim,
  walk,
};
