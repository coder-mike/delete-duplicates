const enumerateFilesInFolder = require('./enumerate-files-in-folder');
const ProgressBar = require('progress');
const _ = require('lodash');
const md5File = require('md5-file/promise');
const createThrottle = require('async-throttle');
const chooseFilesToDelete = require('./choose-files-to-delete');
const fs = require('fs-extra');
const path = require('path');
const Confirm = require('prompt-confirm');
const glob = require('glob');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = async function ({ source, target, dry, silent, moveTo, noCache }) {

  const log = silent ? () => {} : msg => console.log(msg);

  log('Enumerating files...');
  const [sourceDirectory, ...destDirectories] = await Promise.all([
    enumerateFilesInFolder(source),
    ...target.map(enumerateFilesInFolder)
  ]);
  const totalFilesInDest = destDirectories.reduce((t, d) => t + d.files.length, 0);
  log(`Found ${sourceDirectory.files.length} files in source directory "${source}"`);
  log(`Found ${totalFilesInDest} files in destination directories`);

  let bar = !silent && new ProgressBar('[:bar] :path', {
    total: sourceDirectory.files.length + totalFilesInDest,
    width: 50
  });
  const cacheFilename = d => path.join(d.path, 'delete-files-info-cache.json');
  const throttle = createThrottle(1); // Number of file system operations to perform at once
  const extractFileInfo = cache => info => throttle(async () => {
    const { path, relativePath } = info;
    !silent && bar.tick({ path });
    const { mtimeMs, size } = await fs.stat(path);
    const cacheHit = cache && cache.get(path);
    // If it's we have a cache hit, and the size and modified time are the same,
    // then we assume the file is the same as the cache value rather than
    // opening the file to calculate MD5.
    if (cacheHit && cacheHit.mtimeMs === mtimeMs && cacheHit.size === size) {
      return Object.assign(cacheHit, { path, relativePath, mtimeMs, size });
    }
    const hash = await md5File(path);
    return { path, relativePath, hash, mtimeMs, size };
  });

  log('Calculating file hashes...');

  const loadCacheForDir = dir => !noCache && fs.readFile(cacheFilename(dir), 'utf-8')
    .then(cacheFileContents => JSON.parse(cacheFileContents))
    .then(cache => cache.version === '1.0.0' && cache)
    .then(cache => new Map(cache.files.map(file => [file.path, file])))
    .catch(e => false); // If there's a problem, then we just assume no cache file

  const extractDirInfo = async dir => ({
    version: '1.0.0',
    path: dir.path,
    files: await Promise.all(dir.files.map(extractFileInfo(await loadCacheForDir(dir))))
  });
  const sourceDirInfo = await extractDirInfo(sourceDirectory)
  const sourceFileInfos = sourceDirInfo.files;

  const destDirInfos = await Promise.all(destDirectories.map(extractDirInfo));

  // Save cache for next time
  const saveCache = d => fs.writeFile(cacheFilename(d), JSON.stringify(d, null, 4));
  await saveCache(sourceDirInfo);
  await Promise.all(destDirInfos.map(saveCache));

  log('Looking for duplicates...');
  const flatListOfDestFiles = _.flatMap(destDirInfos, f => f.files);
  const actions = chooseFilesToDelete(sourceFileInfos, flatListOfDestFiles);
  const toDelete = actions.filter(action => action.verb === 'delete');
  log(`Will delete ${toDelete.length} duplicate files (see delete-files.txt for a detailed list of files)`);
  fs.writeFile('delete-files.txt', `
    Found ${sourceFileInfos.length} files in source directory "${source}"
    ${destDirectories.map(d => `Found ${d.files.length} files in source directory "${d.path}"
    `)}
    Will delete ${toDelete.length} duplicate files.${
      dry ? `
      (this is a dry run -- no changes will be made)` : ''
    }

    File List:
        ${toDelete.map(file => `${file.sourceFile.path}
            Duplicates:
                ${file.duplicates.map(duplicate => `${duplicate}
                `).join('')}
        `).join('')}
  `);

  if (!dry) {
    if (!silent) {
      const confirmationPrompt = new Confirm(`Are you sure you want to continue?`);
      const response = await confirmationPrompt.run();
      if (!response) {
        console.log('Operation cancelled by user');
        return;
      }
    }
    const moveTarget = f => path.join(moveTo, f.sourceFile.relativePath);
    const removalAction = moveTo
      ? f => fs.move(f.sourceFile.path, moveTarget(f))
      : f => fs.remove(f.sourceFile.path);
    bar = !silent && new ProgressBar('Deleting... [:bar]', {
      total: toDelete.length,
      width: 50
    });
    const deleting = toDelete.map(f => throttle(async () => {
      await removalAction(f);
      bar && bar.tick();
    }));
    const deleted = await Promise.all(deleting);
    console.log('Deleting empty directories in source...');
    const deletedDirCount = await deleteEmptyDirectories(sourceDirectory);
    console.log(`${deleted.length} files deleted or moved`);
    console.log(`${deletedDirCount} directories deleted`);
  }
  return toDelete;

  async function deleteEmptyDirectories(directoryInfo) {
    const dirMap = new Map();
    const rootPath = directoryInfo.path;
    const files = await new Promise((resolve, reject) =>
      glob(`${rootPath}/**/*`, { nodir: true }, (err, files) => err ? reject(err) : resolve(files)));
    const dirs = await new Promise((resolve, reject) =>
      glob(`${rootPath}/**/*/`, { }, (err, files) => err ? reject(err) : resolve(files)));

    for (const dir of dirs) {
      dirMap.set(dir, 0);
    }

    for (const file of files) {
      let dir = path.dirname(file);
      while (dir && dir !== rootPath && dir !== path.dirname(dir)) {
        dirMap.set(dir, (dirMap.get(dir) || 0) + 1);
        dir = rootPath.dirname(dir);
      }
    }

    const descendingLengthComparison = (a, b) => b.length - a.length;
    const toDelete = [...dirMap.entries()]
      .filter(([path, count]) => count === 0) // Empty directories
      .map(([path, count]) => path)
      .sort(descendingLengthComparison);

    const bar = !silent && new ProgressBar('Deleting... [:bar] :path', {
      total: toDelete.length,
      width: 50
    });
    for (const directory of toDelete) {
      await fs.rmdir(directory);
      bar && bar.tick({ path: directory });
    }
    return toDelete.length;
  }
}

