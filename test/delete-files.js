const path = require('path');
const normalizePath = require('normalize-path');
const deleteFiles = require('../lib/delete-files');
const { assert } = require('chai');

describe('delete-files', function() {
  it('Works on test example directory', async function() {
    const result = await deleteFiles({
      source: './test/example/target/source',
      target: [
        './test/example/target'
      ],
      dry: true,
      silent: true
    });
    assert.deepEqual(result, [
      {
        "verb": "delete",
        "path": normalizePath(path.resolve(__dirname + "/example/target/source/a.txt")),
        "duplicates": [
          normalizePath(path.resolve(__dirname + "/example/target/a.txt"))
        ]
      },
      {
        "verb": "delete",
        "path": normalizePath(path.resolve(__dirname + "/example/target/source/b.txt")),
        "duplicates": [
          normalizePath(path.resolve(__dirname + "/example/target/b-different-name.txt"))
        ]
      }
    ]);
  });
});
