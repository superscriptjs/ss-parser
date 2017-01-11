// This is a shim for wordnet lookup.
// http://wordnet.princeton.edu/wordnet/man/wninput.5WN.html

import _ from 'lodash';
import async from 'async';
import WordPOS from 'wordpos';

const wordpos = new WordPOS();

// Unhandled promises should throw top-level errors, not just silently fail
process.on('unhandledRejection', (err) => {
  throw err;
});

// Does a word lookup
// @word can be a word or a word/pos to filter out unwanted types
const lookup = function lookup(word, pointerSymbol = '~', cb) {
  let pos = null;

  const match = word.match(/~(\w)$/);
  if (match) {
    pos = match[1];
    word = word.replace(match[0], '');
  }

  return wordpos.lookup(word).then((results) => {
    const synets = [];

    results.forEach((result) => {
      result.ptrs.forEach((part) => {
        if (pos !== null && part.pos === pos && part.pointerSymbol === pointerSymbol) {
          synets.push(part);
        } else if (pos === null && part.pointerSymbol === pointerSymbol) {
          synets.push(part);
        }
      });
    });

    const itor = (word1, next) => {
      wordpos.seek(word1.synsetOffset, word1.pos).then((sub) => {
        next(null, sub.lemma);
      });
    };

    async.map(synets, itor, (err, items) => {
      items = _.uniq(items);
      items = items.map(x => x.replace(/_/g, ' '));
      cb(err, items);
    });
  });
};

export default {
  lookup,
};
