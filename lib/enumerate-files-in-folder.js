const glob = require('glob');
const normalizePath = require('normalize-path');
const path = require('path');

module.exports = folder => new Promise((resolve, reject) => {
  glob(`${folder}/**/*.*`, {
    nodir: true
  }, function (err, files) {
    if (err) {
      return reject(err);
    }
    const normalizedFilenames = files
      .map(f => path.resolve(f))
      .map(normalizePath);

    resolve(normalizedFilenames);
  })
});