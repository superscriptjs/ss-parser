import fs from 'fs';
import async from 'async';
import _ from 'lodash';
import checksum from 'checksum';
import glob from 'glob';

import { parseContents, normalizeTrigger } from './parseContents';

// Whenever a breaking change occurs, update this version number and the corresponding
// supported version number in SuperScript
const VERSION_NUMBER = 1;

const parseFile = function parseFile(path, factSystem, callback) {
  const startTime = Date.now();
  fs.readFile(path, 'utf-8', (err, contents) => {
    if (err) {
      return callback(`Error reading file: ${err}`);
    }
    return parseContents(contents, factSystem, (err, parsed) => {
      if (err) {
        return callback(`Error whilst processing file: ${path}\n${err}`);
      }
      parsed.version = VERSION_NUMBER;
      console.log(`Time to process file ${path}: ${(Date.now() - startTime) / 1000} seconds`);
      return callback(err, parsed);
    });
  });
};

const findFilesToProcess = function findFilesToProcess(path, cache, callback) {
  glob(`${path}/**/*.ss`, (err, files) => {
    if (err) {
      return callback(err);
    }

    const checksums = {};
    const checkInCache = (file, next) => {
      checksum.file(file, (err, sum) => {
        if (err) {
          return next(err);
        }

        checksums[file] = sum;
        if (cache[file]) {
          return next(null, cache[file] !== sum);
        }
        return next(null, true);
      });
    };

    // Filters out files that have been cached already
    return async.filter(files, checkInCache, (err, filesToLoad) => {
      if (err) {
        return callback(err);
      }

      return callback(null, filesToLoad, checksums);
    });
  });
};

// Cache is a key:sum of files
const parseDirectory = function parseDirectory(path, options, callback) {
  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }

  // Doesn't matter if this is null, we just decide not to use facts in wordnet expansion
  const factSystem = options.factSystem;
  const cache = options.cache || {};

  const startTime = new Date().getTime();

  findFilesToProcess(path, cache, (err, files, checksums) => {
    if (err) {
      return callback(err);
    }

    return async.map(files, (fileName, callback) => {
      parseFile(fileName, factSystem, callback);
    }, (err, res) => {
      if (err) {
        return callback(err);
      }

      let topics = {};
      let gambits = {};
      let replies = {};

      for (let i = 0; i < res.length; i++) {
        topics = _.merge(topics, res[i].topics);
        gambits = _.merge(gambits, res[i].gambits);
        replies = _.merge(replies, res[i].replies);
      }

      const data = {
        topics,
        gambits,
        replies,
        checksums,
        version: VERSION_NUMBER,
      };

      const topicCount = Object.keys(topics).length;
      const gambitsCount = Object.keys(gambits).length;
      const repliesCount = Object.keys(replies).length;

      console.log(`Total time to process: ${(Date.now() - startTime) / 1000} seconds`);
      // console.log("Number of topics %s parsed.", topicCount);
      // console.log("Number of gambits %s parsed.", gambitsCount);
      // console.log("Number of replies %s parsed.", repliesCount);

      if (topicCount !== 0 && gambitsCount !== 0 && repliesCount !== 0) {
        return callback(null, data);
      }

      return callback(null, {});
    });
  });
};

export default {
  normalizeTrigger,
  parseContents,
  parseDirectory,
  parseFile,
};
