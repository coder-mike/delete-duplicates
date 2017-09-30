const _ = require('lodash');

module.exports = function chooseFilesToDelete(sourceFiles, destFiles) {
  const notInSourceList = file => !sourceFilesByPath.has(file.path);

  const sourceFilesByPath = new Map(sourceFiles.map(f => [f.path, f]));

  const destFilesByHash = new Map();
  for (const f of destFiles) {
    let list = destFilesByHash.get(f.hash);
    if (!list) {
      list = [];
      destFilesByHash.set(f.hash, list);
    }
    list.push(f);
  }

  const actionsForFile = sourceFile => {
    const duplicates = (destFilesByHash.get(sourceFile.hash) || [])
      .filter(f => f.path !== sourceFile.path);
    const duplicatesNotInSourceList = duplicates.filter(notInSourceList);
    const mustDeleteFile = duplicatesNotInSourceList.length > 0;
    if (mustDeleteFile) {
      return [{
        verb: 'delete',
        sourceFile,
        duplicates: duplicates.map(fileInfo => fileInfo.path)
      }];
    }
    return []; // No actions
  };
  const actions = _.flatMap(sourceFiles, actionsForFile);
  return actions;
}

