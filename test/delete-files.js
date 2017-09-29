const path = require('path');
const normalizePath = require('normalize-path');
const deleteFiles = require('../lib/delete-files');
const { assert } = require('chai');

describe('delete-files', function() {
  const runTest = ({ noCache }) => async function () {
    const result = await deleteFiles({
      source: './test/example/target/source',
      target: [
        './test/example/target'
      ],
      dry: true,
      silent: true,
      noCache
    });
    assert.deepEqual(result, [
      {
        "verb": "delete",
        "sourceFile": {
          "hash": "0cc175b9c0f1b6a831c399e269772661",
          "mtimeMs": 1506644493902.2776,
          "path": normalizePath(path.resolve(__dirname + "/example/target/source/a.txt")),
          "relativePath": "a.txt",
          "size": 1
        },
        "duplicates": [
          normalizePath(path.resolve(__dirname + "/example/target/a.txt"))
        ]
      },
      {
        "verb": "delete",
        "sourceFile": {
          "hash": "92eb5ffee6ae2fec3ad71c777531578f",
          "mtimeMs": 1506644502936.1265,
          "path": normalizePath(path.resolve(__dirname + "/example/target/source/sub-folder/b.txt")),
          "relativePath": "sub-folder/b.txt",
          "size": 1
        },
        "duplicates": [
          normalizePath(path.resolve(__dirname + "/example/target/b-different-name.txt"))
        ]
      }
    ]);
  }
  it('Works on test example directory', runTest({ noCache : true }));
  it('Works on test example directory using cache', runTest({ noCache : false }));
});
