/* global describe, it */

import should from 'should/as-function';
import async from 'async';
import lang from 'bot-lang';

import { normalizeTrigger } from '../src/parseContents';

// Front loading this rather than lazy loading so we can use `each` over `eachSeries` below.
lang.util.prepFile('replace/contractions.txt');
lang.util.prepFile('replace/spellfix.txt');
lang.util.prepFile('replace/british.txt');
lang.util.prepFile('replace/substitutes.txt');
lang.util.prepFile('replace/frivolous.txt');

const test = [
  { test: 'hello', input: 'hello' },
  { test: '__define_flow__', input: '*' },

  // Simple wildcard
  { test: 'hello', input: '*', matches: ['hello'] },
  { test: 'hello world', input: '*', matches: ['hello world'] },
  { test: 'hello *', input: 'hello *' },
  // Variable Length Wildcards
  { test: 'hello world', input: 'hello *~1', matches: ['world'] },
  { test: 'hello world', input: 'hello *~5' },
  { test: 'hello world', input: 'hello world *~1' },
  { test: 'hello world', input: 'hello *~1 world' },
  { test: 'hello world', input: '*~1 world' },
  // Exact Length Wildcards
  { test: 'hello world', input: 'hello *1', matches: ['world'] },
  { test: 'hello world', input: 'hello world *1', assert: false },
  { test: 'hello world', input: '*3', assert: false },
  { test: 'hello world', input: '*2' },
  // Min Max

  { test: "who is on Brandon's team", input: 'who is on *(1-3) team' },
  { test: 'hello world', input: '*(0-2)', matches: ['hello world'] },
  { test: 'hello world', input: '*(1-3)' },
  { test: 'hello', input: '*(2-5)', assert: false },
  { test: 'x is related to y', input: '*(1-5) is related to *(1-5)', matches: ['x', 'y'] },
  { test: 'hello world', input: '*(1-5) world' }, // leading
  { test: 'hello world', input: 'hello *(1-5)' }, // trailing
  { test: 'hello world', input: 'hello *(0-2)' },
  { test: 'hello world', input: '*(1-2) world *(0-3)' },
  { test: 'hello world boo bar baz buzz bob', input: '*(1-2) world *(0-3)', assert: false },
  { test: 'hello world', input: '*(1-2) world *(1-3)', assert: false },
  { test: '~emohello world', input: '*(1-2) world' },
  { test: 'world ~emohello', input: 'world *(1-2)' },
  { test: 'a b c d:e f', input: 'a *(2-10)' },

  // Alternates
  { test: 'bar', input: '(bar|baz)' },
  { test: 'baz', input: '(bar|baz)' },
  { test: 'a b d', input: 'a (b|c) d' },

  // Optional
  { test: 'foo bar baz', input: 'foo [bar] baz' },
  { test: 'foo bar baz', input: 'foo [bar] [baz] [buz]' },
  { test: 'foo bar baz', input: 'foo [bar|baz] [buz]', assert: false },

  // Advanced
  { test: 'fine', input: '[*] (fine|good) [*]' },
  { test: 'ok fine', input: '[*] (fine|good) [*]' },
  { test: 'sure fine okay', input: '[*] (fine|good) [*]' },

  { test: 'please help me', input: '* help *' },
  { test: 'please help me', input: '* (help) *' },
  { test: 'pleasehelpme', input: '* help *', assert: false },
  { test: 'favorite', input: '* (or) *', assert: false },
  { test: 'baz b foo', input: '*(1-2) (a|b) *(1-2)' },
  { test: 'baz b foo bar', input: '*(1-2) (a|b) *(1-2)' },
  { test: 'baz b foo bar', input: '*~2 (a|b) *~2' },

  { test: 'foo is awesome', input: '*(1-3) is (*)' },
  { test: 'foo is', input: '*(1-3) is (*)', assert: false },
  { test: 'is awesome', input: '*(1-3) is (*)', assert: false },
  { test: 'foo', input: '*(3-99)', assert: false },

  { test: 'Is there a way to enjoy running outside in this awful Toronto cold weather? (-17 Celsius with wind chill)', input: '*(2-99)' },
  { test: 'Is there a way to enjoy running outside in this awful Toronto cold weather? (-17 Celsius with wind chill)', input: '*~99' },

  { test: 'anything', input: '\\*', assert: false },
  { test: '*', input: '\\*' },
  { test: '__test__', input: '__test__' },
  { test: 'redirect testconversation trigger two', input: 'redirect *1 (*)' },

  { test: 'this test is to check if alternates are fine', input: 'this test is to (see|check|determine) if alternates are (fine|working|good)' },
  { test: 'this test is to checkif alternates are working', input: 'this test is to (see|check|determine)if alternates are (fine|working|good)', assert: false },
];

describe('Regex Reply Parse', () => {
  const itor = (item, next) => {
    it(`Test '${item.test}' '${item.input}' should be ${item.assert === false ? 'false' : 'true'}`, (done) => {
      normalizeTrigger(item.input, null, (err, cleanTrigger) => {
        const pattern = new RegExp(`^${cleanTrigger}$`, 'i');

        const cleanTest = lang.replace.all(item.test);
        item.assert = !(item.assert === false);

        if (pattern.test(item.test) !== item.assert && pattern.test(cleanTest) !== item.assert) {
          console.log(`Non-clean trigger: ${item.input}`);
          console.log(`Clean trigger: ${cleanTrigger}`);
          console.log(`Non-clean test input: ${item.test}`);
          console.log(`Clean test input: ${cleanTest}`);
        }

        if (item.assert === false) {
          should(pattern.test(item.test) || pattern.test(cleanTest)).be.false();
        } else {
          should(pattern.test(item.test) || pattern.test(cleanTest)).be.true();
        }

        if (item.matches) {
          const matches = item.test.match(pattern);
          const matchesClean = cleanTest.match(pattern);
          if (matches || matchesClean) {
            // Try matching clean test first, if it fails, try the non-clean one
            try {
              should(matchesClean).containDeep(item.matches);
            } catch (e) {
              should(matches).containDeep(item.matches);
            }
          }
        }

        done();
        next();
      });
    });
  };

  async.each(test, itor, () => {
    console.log('Done');
  });
});
