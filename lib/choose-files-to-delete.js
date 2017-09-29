const _ = require('lodash');

module.exports = function chooseFilesToDelete(sourceFiles, destFiles) {
  const sameHash = sourceFile => destFile => sourceFile.hash === destFile.hash;
  const samePath = sourceFile => destFile => sourceFile.path === destFile.path;

  const actionsForFile = sourceFile => {
    const duplicates = destFiles
      .filter(sameHash(sourceFile))
      .filter(destFile => !samePath(sourceFile)(destFile));
    const notInSourceList = file => !sourceFiles.some(samePath(file));
    const duplicatesNotInSourceList = duplicates.filter(notInSourceList);
    const mustDeleteFile = duplicatesNotInSourceList.length > 0;
    if (mustDeleteFile) {
      return [{
        verb: 'delete',
        path: sourceFile.path,
        duplicates: duplicates.map(fileInfo => fileInfo.path)
      }];
    }
    return []; // No actions
  };
  const actions = _.flatMap(sourceFiles, actionsForFile);
  return actions;
}

