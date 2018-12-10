const { parseRecords } = require('./parser');
const { archiveFromRecordStream } = require('./lexer');
const { Archive, Directory, File } = require('./data');
const { ParseProblem, LexicalProblem } = require('./util/problem');

module.exports = {
  archiveFromStream: (stream) => archiveFromRecordStream(parseRecords(stream)),
  Archive, Directory, File,
  ParseProblem, LexicalProblem
};

