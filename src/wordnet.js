// This is a shim for wordnet lookup.
// http://wordnet.princeton.edu/wordnet/man/wninput.5WN.html

import _ from 'lodash';
import async from 'async';
import natural from 'natural';
import WordPOS from 'wordpos';

const wordpos = new WordPOS();
const wordnet = new natural.WordNet();

// Does a word lookup
// @word can be a word or a word/pos to filter out unwanted types
const lookup = function lookup(word, pointerSymbol = '~', cb) {
  let pos = null;

  const match = word.match(/~(\w)$/);
  if (match) {
    pos = match[1];
    word = word.replace(match[0], '');
  }

  let lookupDone = false;
  let lookupResults = [];

  wordpos.lookup(word).then((results) => {
    lookupDone = true;
    lookupResults = results;
  }).catch((err) => {
    lookupDone = true;
    console.error(err);
  });

  // I will be the first to admit that this sucks. But wordpos.lookup returns a promise
  // which swallows errors in the callback. So if a exception is raised right at the end
  // of the callback chain, it would be caught within this promise catch block, which is
  // highly unintuitive and ruins any error messages. So just keep polling until done.
  // Why then, use wordpos, you say? It's about 5x faster than wordnet.
  // One day, maybe we'll rewrite this whole thing to use promises. Until then...
  const wait = function wait() {
    if (!lookupDone) {
      setTimeout(wait, 10);
    } else {
      const synets = [];

      lookupResults.forEach((result) => {
        result.ptrs.forEach((part) => {
          if (pos !== null && part.pos === pos && part.pointerSymbol === pointerSymbol) {
            synets.push(part);
          } else if (pos === null && part.pointerSymbol === pointerSymbol) {
            synets.push(part);
          }
        });
      });

      const itor = (word1, next) => {
        wordnet.get(word1.synsetOffset, word1.pos, (sub) => {
          next(null, sub.lemma);
        });
      };

      async.map(synets, itor, (err, items) => {
        items = _.uniq(items);
        items = items.map(x => x.replace(/_/g, ' '));
        cb(err, items);
      });
    }
  };

  wait();
};

export default {
  lookup,
};
