import _ from 'lodash';
import replace from 'async-replace';
import debuglog from 'debug';

import Utils from './utils';
import wordnet from './wordnet';

const debug = debuglog('RegexReply');
const dWarn = debuglog('RegexReply:Warning');

// Prepares a trigger for the regular expression engine.
const processAlternates = function processAlternates(reply) {
  // input Alternates.

  const primary = reply.match(/(.?\(.+?\))/g);
  if (primary) {
    for (let n = 0; n < primary.length; n++) {
      // Filter out new Min, Max Wildcard Syntax
      if (primary[n][0] !== '*') {
        const match = primary[n].match(/\((.+?)\)/g);
        if (match) {
          for (let i = 0; i < match.length; i++) {
            const altGroup = match[i];
            const altMatch = altGroup.match(/\((.+?)\)/);

            const altStr = altMatch[1];
            const parts = altStr.split('|');

            let opts = [];
            for (let nn = 0; nn < parts.length; nn++) {
              opts.push(parts[nn].trim());
            }

            opts = `(\\b${opts.join('\\b|\\b')}\\b)\\s?`;
            reply = reply.replace(altGroup, opts);
          }
        }
      }
    }
  }

  return reply;
};

const parse = function parse(regexp, facts, callback) {
  regexp = processAlternates(regexp);

  // If the trigger is simply '*' then the * needs to become (.*?)
  // to match the blank string too.
  regexp = regexp.replace(/^\*$/, '<zerowidthstar>');

  // Simple replacements.
  // This replacement must be done before the next or they will conflict.
  // * replacement is now optional by default meaning 0,n
  // Match Single * allowing *~n and *n to pass though
  // regexp = regexp.replace(/\s?\*(?!~?\d)\s?/g, "(?:.*\\s?)");  // Convert * into (.*)
  // Added new (min-max) - http://rubular.com/r/lW6FoLRxph
  regexp = regexp.replace(/\s?\*(?![~?\d\(])\s?/g, '(?:.*\\s?)');  // Convert * into (.*)

  // Step 1 nWidthStar
  // (\s?(?:[\w]*\s?){n})
  // Here we match *n where n is the number of words to allow
  // This provides much more flexibility around matching adverbs with nouns.
  // We deliberately slurp in the trailing space to support zero or more words
  const nWidthStarMatch = (match, p1) =>
     `<${parseInt(p1)}ewidthstar>`
  ;

  // Step 2 nWidthStar
  // (\s?(?:[\w]*\s?){0,n})
  const varWidthStarReplace = (match, p1) => {
    const num = parseInt(p1.replace('~', ''));
    return `<${num}vwidthstar>`;
  };

  // Step 3 mix-maxWidthStar
  const mmWidthStarReplace = (match, p1) => {
    const parts = p1.split('-');
    if (parts.length === 2) {
      const v1 = parseInt(parts[0]);
      const v2 = parseInt(parts[1]);
      if (v1 === v2) {
        dWarn('MM Values are the same, dropping back to Variable Match');
        return `<${v2}vwidthstar>`;
      }
      return `<${v1},${v2}mmwidthstar>`;
    }
  };

  // Convert *n into multi word EXACT match
  regexp = regexp.replace(/\*([0-9]{1,2})/g, nWidthStarMatch);

  // Convert *(n) into multi word EXACT match
  regexp = regexp.replace(/\*\(([0-9]{1,2}\s?)\)/g, nWidthStarMatch);

  // Convert *~n into multi word VARIABLE match
  regexp = regexp.replace(/\s?\*(~[0-9]{1,2}\s?)/g, varWidthStarReplace);

  // Convert *(n-m) into multi word VARIABLE match
  regexp = regexp.replace(/\s*\*\((\d{1,2}\-\d{1,2}\s?)\)\s*/g, mmWidthStarReplace);
  regexp = regexp.replace(/<zerowidthstar>/g, '(?:.*?)');

  // Handle WordNet
  const wordnetReplace = function wordnetReplace(match, sym, word, p3, offset, done) {
    const wordnetLookup = () => wordnet.lookup(word, sym, (err, words) => {
      if (err) {
        console.log(err);
      }

      // TODO: add a space around the terms
      words = words.map(item => item.replace(/_/g, ' '));

      if (_.isEmpty(words)) {
        dWarn('Creating a trigger with a word NOT EXPANDED', match);
        done(null, match);
      } else {
        words = `(\\b${words.join('\\b|\\b')}\\b)`;
        debug('Wordnet Replies', words);
        done(null, words);
      }
    });

    // Use fact system first.
    if (facts) {
      return facts.conceptToList(word.toLowerCase(), (err, words) => {
        if (err) {
          console.log(err);
        }

        if (!_.isEmpty(words)) {
          words = `(\\b${words.join('\\b|\\b')}\\b)`;
          debug('Fact Replies', words);
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

  replace(regexp, /(~)(\w[\w]+)/g, wordnetReplace, (err, result) => {
    if (err) {
      console.log(err);
    }

    regexp = result;

    // Optionals.
    let match = regexp.match(/\[(.+?)\]/);
    let depth = 0;
    while (match) {
      depth += 1;
      if (depth >= 50) {
        dWarn('Infinite loop when trying to process optionals in trigger!');
        return '';
      }

      const parts = match[1].split('|');
      const opts = [];
      for (let i = 0; i < parts.length; i++) {
        const p = `\\s*${parts[i]}\\s*`;
        opts.push(p);
      }

      opts.push('\\s*');

      // If this optional had a star or anything in it, make it non-matching.
      let pipes = opts.join('|');
      pipes = pipes.replace(new RegExp(Utils.quotemeta('(.+?)'), 'g'), '(?:.+?)');
      pipes = pipes.replace(new RegExp(Utils.quotemeta('(\\d+?)'), 'g'), '(?:\\d+?)');
      pipes = pipes.replace(new RegExp(Utils.quotemeta('([A-Za-z]+?)'), 'g'), '(?:[A-Za-z]+?)');

      regexp = regexp.replace(new RegExp(`\\s*\\[${Utils.quotemeta(match[1])}\\]\\s*`),
        `(?:${pipes})`);
      match = regexp.match(/\[(.+?)\]/); // Circle of life!
    }

    // neWidthStar
    const exactWidthReplace = function exactWidthReplace(match2, p1) {
      return `(\\S+(?:\\s+\\S+){${parseInt(p1) - 1}})`;
    };

    regexp = regexp.replace(/<(\d+)ewidthstar>/g, exactWidthReplace);

    // nvWidthStar
    const varWidthReplace = function varWidthReplace(match3, p1) {
      return `\\s*(\\s?(?:[\\w-:]*\\??\\.?\\,?\\s*\\~?\\(?\\)?){0,${parseInt(p1)}})`;
    };

    regexp = regexp.replace(/<(\d+)vwidthstar>/g, varWidthReplace);

    // mmvWidthStar
    const mmWidthReplace = function mmWidthReplace(match4, p1) {
      const parts = p1.split(',');
      const min = parseInt(parts[0]);
      const max = parseInt(parts[1]);
      let expression;
      if (min < 2) {
        expression = "\\s*((?:\\(?\\~?[\\w-:]+[\\?\\.\\'\\,\\s\\~\\)]*?)";
      } else {
        expression = "\\s*((?:\\(?\\~?[\\w-:]+[\\?\\.\\'\\,\\s\\~\\)]+[\\w-:]+[\\?\\.\\'\\,\\s\\~\\)]*?)";
      }
      return `${expression}{${min},${max}})\\s?`;
    };

    regexp = regexp.replace(/<(\d+,\d+)mmwidthstar>/g, mmWidthReplace);

    // We want to pad "* baz *" with word boundries
    match = regexp.match(/^\(\?:\.\*\\s\?\)(.*)\(\?:\.\*\\s\?\)$/);
    if (match) {
      regexp = `(?:.*\\s?)\\b${match[1]}\\b(?:.*\\s?)`;
    }

    callback(regexp);
  });
};

export default { parse };
