const enumerateFilesInFolder = require('./enumerate-files-in-folder');
const ProgressBar = require('progress');
const _ = require('lodash');
const md5File = require('md5-file/promise');
const createThrottle = require('async-throttle');
const chooseFilesToDelete = require('./choose-files-to-delete');
const fs = require('fs-extra');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = async function ({ source, target, dry, silent }) {

  const log = silent ? () => {} : msg => console.log(msg);

  log('Enumerating files...');
  const [sourceFilenames, ...destDirectories] = await Promise.all([
    enumerateFilesInFolder(source),
    ...target.map(enumerateFilesInFolder)
  ]);
  const destFileNames = _.flatten(destDirectories);
  log(`Found ${sourceFilenames.length} files in source directory "${source}"`);
  log(`Found ${destFileNames.length} files in destination directories`);

  const bar = !silent && new ProgressBar('[:bar] :path', {
    total: sourceFilenames.length + destFileNames.length,
    width: 50
  });
  const throttle = createThrottle(1); // Process at most 5 files at a time
  const extractFileInfo = path => throttle(async () => {
    !silent && bar.tick({ path });
    const hash = await md5File(path);
    return { path, hash };
  });
  log('Calculating file hashes...');
  const sourceFiles = await Promise.all(sourceFilenames.map(extractFileInfo));
  const destFiles = await Promise.all(destFileNames.map(extractFileInfo));

  log('Looking for duplicates...');
  const actions = chooseFilesToDelete(sourceFiles, destFiles);
  const toDelete = actions.filter(action => action.verb === 'delete');
  log(`Will delete ${toDelete.length} duplicate files`);
  fs.writeFile('delete-files.txt', `
    Found ${sourceFilenames.length} files in source directory "${source}"
    Found ${destFileNames.length} files in destination directories
    Will delete ${toDelete.length} duplicate files.${
      dry ? `
      (this is a dry run -- no changes will be made)` : ''
    }

    File List:
        ${toDelete.map(file => `${file.path}
            Duplicates:
                ${file.duplicates.map(duplicate => `${duplicate}
                `).join('')}
        `).join('')}
  `);

  if (!dry) {

  }

  return toDelete;
}
