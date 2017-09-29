const parseArguments = require('./lib/parse-arguments');
const deleteFiles = require('./lib/delete-files');

const args = parseArguments();
deleteFiles(args)
  .catch(e => console.error(e));
