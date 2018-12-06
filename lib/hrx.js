const { parseRecords } = require('./parser');
const { archiveFromRecordStream } = require('./lexer');

module.exports = {
  archiveFromStream: (stream) => archiveFromRecordStream(parseRecords(stream))
};

