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
const normalizePath = require('normalize-path');
const writeFileAtomic = require('write-file-atomic')

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = async function ({ source, target, dry, silent, moveTo, noCache }) {

  const log = silent ? () => {} : msg => console.log(msg);

  log('Enumerating files...');
  const [sourceDir, ...destDirectories] = await Promise.all([
    enumerateFilesInFolder(source),
    ...target.map(enumerateFilesInFolder)
  ]);
  const totalFilesInDest = destDirectories.reduce((t, d) => t + d.files.length, 0);
  log(`Found ${sourceDir.files.length} files in source directory "${source}"`);
  log(`Found ${totalFilesInDest} files in destination directories`);

  let bar = !silent && new ProgressBar('[:bar] :current/:total :etas :path', {
    total: sourceDir.files.length + totalFilesInDest,
    width: 50
  });
  const pathSymbol = Symbol('path');
  const cacheFilename = dirPath => path.join(dirPath, 'delete-files-info-cache.json');
  const throttle = createThrottle(1); // Number of file system operations to perform at once
  const extractFileInfo = (dir, cache) => relativePath => throttle(async () => {
    const fullFilePath = path.join(dir.path, relativePath);
    !silent && bar.tick({ path: relativePath });
    const { mtimeMs, size } = await fs.stat(fullFilePath);
    const cacheHit = cache && cache.get(relativePath);
    // If we have a cache hit, and the size and modified time are the same, then
    // we assume the file is the same as the cache value rather than opening the
    // file to calculate MD5.
    if (cacheHit && cacheHit.mtimeMs === mtimeMs && cacheHit.size === size) {
      return Object.assign(cacheHit, { relativePath, mtimeMs, size });
    }

    const hash = await md5File(fullFilePath);
    return { relativePath, hash, mtimeMs, size };
  });

  log('Calculating file hashes...');

  const loadCacheForDir = dir => !noCache && fs.readFile(cacheFilename(dir.path), 'utf-8')
    .then(cacheFileContents => JSON.parse(cacheFileContents))
    .then(cache => cache.version === '1.0.0' && cache)
    .then(cache => new Map(cache.files.map(file => [
      file.relativePath, // key
      file // value
    ])))
    .catch(e => false); // If there's a problem, then we just assume no cache file

  const extractDirInfo = async dir => ({
    version: '1.0.0',
    [pathSymbol]: dir.path, // Metadata used for saving
    files: await Promise.all(dir.files.map(extractFileInfo(dir, await loadCacheForDir(dir))))
  });
  const sourceDirInfo = await extractDirInfo(sourceDir)
  const sourceFileInfos = sourceDirInfo.files;

  const destDirInfos = await Promise.all(destDirectories.map(extractDirInfo));

  // Save cache for next time
  const saveCache = cache => writeFileAtomic(cacheFilename(cache[pathSymbol]), JSON.stringify(cache, null, 4));
  await saveCache(sourceDirInfo);
  await Promise.all(destDirInfos.map(saveCache));

  // The algorithms use the full path as an indication of items that point to the same file
  sourceDirInfo.files.forEach(f => f.path = normalizePath(path.join(sourceDirInfo[pathSymbol], f.relativePath)));
  for (const destDirInfo of destDirInfos) {
    destDirInfo.files.forEach(f => f.path = normalizePath(path.join(destDirInfo[pathSymbol], f.relativePath)));
  }

  log('Looking for duplicates...');
  const flatListOfDestFiles = _.flatMap(destDirInfos, f => f.files);
  const actions = chooseFilesToDelete(sourceFileInfos, flatListOfDestFiles);
  const toDelete = actions.filter(action => action.verb === 'delete');
  log(`Will ${moveTo ? 'move' : 'delete'} ${toDelete.length} duplicate files (see delete-files.txt for a detailed list of files)`);
  fs.writeFile('delete-files.txt', `
    Found ${sourceFileInfos.length} files in source directory "${source}"
    ${destDirectories.map(d => `Found ${d.files.length} files in source directory "${d.path}"
    `)}
    Will ${moveTo ? 'move' : 'delete'} ${toDelete.length} duplicate files.${
      dry ? `
      (this is a dry run -- no changes will be made)` : ''
    }

    File List:
        ${toDelete.map(file => `Source ${file.sourceFile.path}
            Duplicates:
                ${file.duplicates.map(duplicate => `Target ${duplicate}
                `).join('')}
        `).join('')}
  `);

  if (!dry) {
    if (!silent) {
      process.stdout.write('\u0007');
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
    bar = !silent && new ProgressBar(`${moveTo ? 'Moving' : 'Deleting'}... [:bar]`, {
      total: toDelete.length,
      width: 50
    });
    const deleting = toDelete.map(f => throttle(async () => {
      await removalAction(f);
      bar && bar.tick();
    }));
    const deleted = await Promise.all(deleting);
    log('Deleting empty directories in source...');
    const deletedDirCount = await deleteEmptyDirectories(sourceDir);
    log(`${deleted.length} files deleted or moved`);
    log(`${deletedDirCount} directories deleted`);
    !silent && process.stdout.write('\u0007');
  }
  return toDelete;

  async function deleteEmptyDirectories(directoryInfo) {
    const dirMap = new Map();
    const rootPath = directoryInfo.path;
    const files = await new Promise((resolve, reject) =>
      glob(`${rootPath}/**/*`, { nodir: true, dot: true }, (err, files) => err ? reject(err) : resolve(files)));
    const dirs = await new Promise((resolve, reject) =>
      glob(`${rootPath}/**/*/`, { dot: true }, (err, files) => err ? reject(err) : resolve(files)));

    for (const dir of dirs) {
      dirMap.set(normalizePath(dir), []);
    }

    for (const file of files) {
      let dir = path.dirname(file);
      while (dir && dir !== rootPath && dir !== path.dirname(dir)) {
        const key = normalizePath(dir);
        // We keep a list rather than a set because it's easier to debug
        let list = dirMap.get(key);
        if (!list) {
          list = [];
          dirMap.set(key, list);
        }
        list.push(file);
        dir = path.dirname(dir);
      }
    }

    const descendingLengthComparison = (a, b) => b.length - a.length;
    const toDelete = [...dirMap.entries()]
      .filter(([path, list]) => list.length === 0) // Empty directories
      .map(([path, list]) => path)
      .sort(descendingLengthComparison);

    const bar = !silent && new ProgressBar('Deleting... [:bar] :path', {
      total: toDelete.length,
      width: 50
    });
    for (const directory of toDelete) {
      try {
        await fs.rmdir(directory);
      } catch (e) {
        console.log('');
        console.error(e);
      }
      bar && bar.tick({ path: directory });
    }
    return toDelete.length;
  }
}

