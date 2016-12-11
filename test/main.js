/* global describe, it */

import should from 'should/as-function';

import parser from '../src';

const findByTrigger = function findByTrigger(data, raw) {
  for (const gam in data.gambits) {
    if (data.gambits[gam].trigger.raw === raw) {
      return data.gambits[gam];
    }
  }
};

describe('Should Parse Input', () => {
  it('Should be an object', (done) => {
    parser.loadDirectory(`${__dirname}/fixtures/main.ss`, (err, result) => {
      // Should have the following keys
      should(Object.keys(result)).eql(['topics', 'gambits', 'replies', 'checksums', 'version']);

      // We should have 4 topics
      should(Object.keys(result.topics)).eql(['__pre__', '__post__', 'random2', 'random']);

      // We should have some gambits
      should(Object.keys(result.gambits)).have.length(35);
      should(Object.keys(result.replies)).have.length(36);

      // Lets make sure we have a conversations array as well
      const key = Object.keys(result.gambits).pop();
      should(result.gambits[key].conversation).have.length(3);
      should(findByTrigger(result, 'this is in pre').topic).eql('__pre__');

      done();
    });
  });

  it('Should parse comprehensive script of features', (done) => {
    parser.loadDirectory(`${__dirname}/fixtures/parserFeatures.ss`, (err, result) => {
      done();
    });
  });
});
