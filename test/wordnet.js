import mocha from 'mocha';
import should from 'should';
import wordnet from '../src/wordnet';

describe('Wordnet', () => {
  it('Should define a word.', (done) => {
    wordnet.define('sit', (err, results) => {
      should.not.exist(err);
      results.should.not.be.empty;
      done();
    });
  });
  it('Should explore a word.', (done) => {
    wordnet.explore('sit', (err, results) => {
      should.not.exist(err);
      done();
    });
  });
});
