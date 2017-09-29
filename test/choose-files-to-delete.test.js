const chooseFilesToDelete = require('../lib/choose-files-to-delete');
const { describe, it } = require('mocha');
const { assert } = require('chai');

describe('choose-files-to-delete', function() {
  it('Empty source', function() {
    const actions = chooseFilesToDelete([], []);
    assert.deepEqual(actions, []);
  });

  it('Deletes duplicate file', function() {
    const sourceFiles = [{
      path: 'D:/temp/source/bob.txt',
      hash: '123'
    }];
    const destDirs = [{
      path: 'D:/temp/dest1/bob.txt',
      hash: '123'
    }];
    const actions = chooseFilesToDelete(sourceFiles, destDirs);
    assert.deepEqual(actions, [{
      verb: 'delete',
      path: 'D:/temp/source/bob.txt',
      duplicates: [
        'D:/temp/dest1/bob.txt'
      ]
    }]);
  });

  it('Does not delete non-duplicate file', function() {
    const sourceFiles = [{
      path: 'D:/temp/source/bob.txt',
      hash: '123'
    }];
    const destDirs = [{
      path: 'D:/temp/dest1/bob.txt',
      hash: '321'
    }];
    const actions = chooseFilesToDelete(sourceFiles, destDirs);
    assert.deepEqual(actions, []);
  });

  it('Does not delete source file', function() {
    const sourceFiles = [{
      path: 'D:/temp/source/bob.txt',
      hash: '123'
    }, {
      path: 'D:/temp/dest1/bob.txt',
      hash: '123'
    }];
    const destDirs = [{
      path: 'D:/temp/dest1/bob.txt',
      hash: '123'
    }];
    const actions = chooseFilesToDelete(sourceFiles, destDirs);
    assert.deepEqual(actions, []);
  });
});