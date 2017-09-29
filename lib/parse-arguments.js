const { ArgumentParser } = require('argparse');

const parser = new ArgumentParser({
  version: '1.0.0',
  addHelp: true,
  description: 'Deletes files in a "source" directory, when they are duplicates of files in a "target" directory'
});

parser.addArgument(
  'source',
  {
    help: 'The directory in which to *delete* files'
  }
);

parser.addArgument(
  '--target',
  {
    defaultValue: [],
    action: 'append',
    help: 'The directory in which to identify files *not* to delete in the source'
  }
);

parser.addArgument(
  '--move-to',
  {
    dest: 'moveTo',
    help: 'The directory to which to move the deleted files, instead of deleting them'
  }
);

parser.addArgument(
  '--dry',
  {
    action: 'storeTrue',
    help: 'Flag to not perform any actions'
  }
);

parser.addArgument(
  '--silent',
  {
    action: 'storeTrue',
    help: 'Flag to prevent prompts and logging output'
  }
);

parser.addArgument(
  '--no-cache',
  {
    action: 'storeTrue',
    help: 'Flag to prevent using cache file'
  }
);

module.exports = () => parser.parseArgs();
