require('should');
const { archiveFromStream, Archive, Directory, File, ParseProblem, LexicalProblem } = require('../lib/hrx');
const { fromChunks } = require('streamtest').v2;

describe('integration', () => {
  // just a couple basic integration tests.
  it('should be happy with a well-formed input', () => archiveFromStream(fromChunks([
`<=====>
some file comment
<====>
<=====> directory/nested/file
test file contents
<=====>
directory comment
<=====> directory/nested/
<=====>
archive comment
<===`
  ])).should.be.fulfilledWith(new Archive({
    directory: new Directory('directory', {
      nested: new Directory('directory/nested', {
        file: new File('directory/nested/file', 'test file contents', 'some file comment\n<====>')
      }, 'directory comment')
    })
  }, 'archive comment\n<===')));

  it('should be unhappy with a malformed parsing input', () => archiveFromStream(fromChunks([
    '<===hello'
  ])).should.be.rejectedWith(ParseProblem, { line: 1, col: 5 }));

  it('should be unhappy with a malformed lexing input', () => archiveFromStream(fromChunks([
    '<===> file\n<===> file\n'
  ])).should.be.rejectedWith(LexicalProblem, { line: 3 }));
});

