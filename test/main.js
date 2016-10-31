import mocha from 'mocha';
import should from 'should';

import parser from '../src';

const findByTrigger = function findByTrigger(data, raw) {
  for (const gam in data.gambits) {
    if (data.gambits[gam].raw === raw) {
      return data.gambits[gam];
    }
  }
};

describe('Should Parse Input', () => {
  it('Should be an object', (done) => {
    parser.loadDirectory('./test/fixtures/main.ss', (err, result) => {
      // Should have the following keys
      ['topics', 'gambits', 'conditions', 'replies', 'checksums'].should.eql(Object.keys(result));

      // We should have 4 topics
      ['random', '__pre__', '__post__', 'random2'].should.eql(Object.keys(result.topics));

      // We should have some gambits
      Object.keys(result.gambits).should.have.length(35);
      Object.keys(result.replies).should.have.length(36);

      // Lets make sure we have a conversations array as well
      const key = Object.keys(result.gambits).pop();
      result.gambits[key].options.conversations.should.have.length(3);
      findByTrigger(result, 'this is in pre').topic.should.eql('__pre__');

      done();
    });
  });
});
