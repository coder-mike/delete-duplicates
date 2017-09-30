const glob = require('glob');
const normalizePath = require('normalize-path');
const path = require('path');

module.exports = directory => new Promise((resolve, reject) => {
  directory = normalizePath(path.resolve(directory));
  glob(`${directory}/**/*`, {
    nodir: true,
    dot: true
  }, function (err, files) {
    if (err) {
      return reject(err);
    }
    return resolve({
      path: directory,
      files: files.map(f => normalizePath(path.relative(directory, f)))
    });
  })
});