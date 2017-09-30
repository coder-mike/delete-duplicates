const path = require('path');
const normalizePath = require('normalize-path');
const deleteFiles = require('../lib/delete-files');
const fs = require('fs-extra')
const { assert } = require('chai');
const glob = require('glob');

describe('Black box test', function() {
  const runTests = (useCache, move, expectedOutputState) => async function () {
    await fs.remove('temp');
    await fs.copy('test/example', 'temp');
    if (useCache) {
      // Do a dry run to build the cache
      await deleteFiles({
        source: './temp/target/source',
        target: ['./temp/target'],
        silent: true,
        dry: true
      });
    }
    await deleteFiles({
      source: './temp/target/source',
      target: ['./temp/target'],
      moveTo: move && './temp/to-delete',
      silent: true,
      noCache: !useCache
    });
    const outputState = await new Promise((resolve, reject) =>
      glob('temp/**/*', { }, (err, files) => err ? reject(err) : resolve(files)));
    assert.deepEqual(outputState, expectedOutputState)
    await fs.remove('temp');
  }
  it('Works', runTests(false, false, [
    "temp/target",
    "temp/target/a.txt",
    "temp/target/b-different-name.txt",
    "temp/target/c-different-content.txt",
    "temp/target/delete-files-info-cache.json",
    "temp/target/e-not-in-source.txt",
    "temp/target/source",
    "temp/target/source/c-different-content.txt",
    "temp/target/source/d-not-in-dest.txt",
    "temp/target/source/delete-files-info-cache.json",
    "temp/target/source/f-duplicate-in-source-2.txt",
    "temp/target/source/f-duplicate-in-source.txt",
  ]));
  it('Works with cache', runTests(true, false, [
    "temp/target",
    "temp/target/a.txt",
    "temp/target/b-different-name.txt",
    "temp/target/c-different-content.txt",
    "temp/target/delete-files-info-cache.json",
    "temp/target/e-not-in-source.txt",
    "temp/target/source",
    "temp/target/source/c-different-content.txt",
    "temp/target/source/d-not-in-dest.txt",
    "temp/target/source/delete-files-info-cache.json",
    "temp/target/source/f-duplicate-in-source-2.txt",
    "temp/target/source/f-duplicate-in-source.txt",
  ]));
  it('Works moving', runTests(false, true, [
    "temp/target",
    "temp/target/a.txt",
    "temp/target/b-different-name.txt",
    "temp/target/c-different-content.txt",
    "temp/target/delete-files-info-cache.json",
    "temp/target/e-not-in-source.txt",
    "temp/target/source",
    "temp/target/source/c-different-content.txt",
    "temp/target/source/d-not-in-dest.txt",
    "temp/target/source/delete-files-info-cache.json",
    "temp/target/source/f-duplicate-in-source-2.txt",
    "temp/target/source/f-duplicate-in-source.txt",
    "temp/to-delete",
    "temp/to-delete/a.txt",
    "temp/to-delete/sub-folder",
    "temp/to-delete/sub-folder/b.txt",
  ]));
});