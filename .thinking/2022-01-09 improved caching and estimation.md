# Improved caching and estimation

When I'm running this tool, I see 2 annoying issues:

  1. I tend to run the tool multiple times at different directory levels, and each time it needs to recalculate the cache. It would be much more efficient if we could cache at a more granular level (e.g. each folder) or be able to find caches at outer folders.

  2. The estimated time remaining is completely broken for me. My directories are a combination of large and small files, and some of them are a cache hit and some not. The estimate doesn't take these into account.

For me, this is a long-running tool. It spends most of its time calculating hashes. It should be treated as such.

I'm proposing the following upgrades:

  1. I want to output the cache file more frequently, so that if the process is terminated then we don't lose all the work performed.

  2. I'll use [write-file-atomic](https://www.npmjs.com/package/write-file-atomic) to write cache files, rather than just writing directly, so that if the process is terminated during a cache flush then it doesn't break that cache file.

  3. When writing cache files, I'll keep the logic of writing only to the directories specified on the CLI, rather than littering cache files everywhere. But when reading cache files, I'll search at all parent levels of the file so that it can find hashes calculated for different subsets/supersets of the specified directory.

  4. I'll show the progress bar in MB rather than file count, and I will ignore the files that already appear in the cache.

  5. TODO also: I want to verify that the algorithm will not just die in the middle if one of the found files goes missing before the hash is calculated (e.g. if the user is also manually cleaning up while running the program).

  6. TODO: The cache file should be named starting with `.`

----

Writing the cache more frequently is actually quite a major refactoring. The reason is that `extractDirInfo` is what computes the cache structure, and it does so in one go at the moment. Then the returned value (the "cache") is saved.

I'm debating whether to upgrade this project to TypeScript.