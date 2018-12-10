require('should');
const { fromObjects, fromChunks } = require('streamtest').v2;
const { ParseProblem, LexicalProblem } = require('../lib/util/problem');
const { parseRecords } = require('../lib/parser');
const { archiveFromRecordStream } = require('../lib/lexer');
const { Archive, Directory, File } = require('../lib/data');

// just cut down on wordy boilerplate:
const lexing = (records) => archiveFromRecordStream(fromObjects(records));

describe('lexing', () => {
  it('should pass stream errors through to Promise rejections', () =>
    archiveFromRecordStream(parseRecords(fromChunks([ '<>' ])))
      .should.be.rejectedWith(ParseProblem));

  it('should complain given back-to-back comments', () => lexing([
    { type: 'comment', body: 'one' },
    { type: 'comment', body: 'two' }
  ]).should.be.rejectedWith(LexicalProblem));

  describe('files', () => {
    it('should create a File with the appropriate details', () => lexing([
      { type: 'file', path: 'test.file', body: 'hello' }
    ]).then((archive) => {
      archive.should.eql(new Archive({
        'test.file': new File('test.file', 'hello')
      }));
    }));

    it('should create an implicitly nested File with the appropriate details', () => lexing([
      { type: 'file', path: 'nested/directory/test.file', body: 'hello' }
    ]).then((archive) => {
      archive.should.eql(new Archive({
        nested: new Directory('nested', {
          directory: new Directory('nested/directory', {
            'test.file': new File('nested/directory/test.file', 'hello')
          })
        })
      }));
    }));

    it('should cohabitate root Files correctly', () => lexing([
      { type: 'file', path: 'test.file', body: 'hello' },
      { type: 'file', path: 'another_file', body: 'goodbye' }
    ]).then((archive) => {
      archive.should.eql(new Archive({
        'test.file': new File('test.file', 'hello'),
        'another_file': new File('another_file', 'goodbye')
      }));
    }));

    it('should cohabitate nested Files correctly', () => lexing([
      { type: 'file', path: 'nested/directory/test.file', body: 'hello' },
      { type: 'file', path: 'nested/directory/another_file', body: 'goodbye' }
    ]).then((archive) => {
      archive.should.eql(new Archive({
        nested: new Directory('nested', {
          directory: new Directory('nested/directory', {
            'test.file': new File('nested/directory/test.file', 'hello'),
            'another_file': new File('nested/directory/another_file', 'goodbye')
          })
        })
      }));
    }));

    it('should nest non-sibling Files correctly', () => lexing([
      { type: 'file', path: 'nested/test.file', body: 'hello' },
      { type: 'file', path: 'nested/directory/another_file', body: 'goodbye' }
    ]).then((archive) => {
      archive.should.eql(new Archive({
        nested: new Directory('nested', {
          'test.file': new File('nested/test.file', 'hello'),
          directory: new Directory('nested/directory', {
            'another_file': new File('nested/directory/another_file', 'goodbye')
          })
        })
      }));
    }));

    it('should attach comments appropriately', () => lexing([
      { type: 'comment', body: 'a comment' },
      { type: 'file', path: 'test.file', body: 'hello' },
      { type: 'file', path: 'another_file', body: 'how are you?' },
      { type: 'comment', body: 'a second comment' },
      { type: 'file', path: 'last', body: 'goodbye' }
    ]).then((archive) => {
      archive.should.eql(new Archive({
        'test.file': new File('test.file', 'hello', 'a comment'),
        'another_file': new File('another_file', 'how are you?'),
        'last': new File('last', 'goodbye', 'a second comment')
      }));
    }));

    it('should complain given duplicate pathed Files', () => lexing([
      { type: 'file', path: 'test.file', body: 'hello' },
      { type: 'file', path: 'test.file', body: 'how are you?' }
    ]).should.be.rejectedWith(LexicalProblem, { details: { path: 'test.file' } }));

    it('should complain if a File tries to overwrite an explicit Directory', () => lexing([
      { type: 'directory', path: 'dir' },
      { type: 'file', path: 'dir', body: 'how are you?' }
    ]).should.be.rejectedWith(LexicalProblem, { details: { path: 'dir' } }));

    it('should complain if a File tries to overwrite an implicit Directory', () => lexing([
      { type: 'file', path: 'dir/file', body: 'hello' },
      { type: 'file', path: 'dir', body: 'how are you?' }
    ]).should.be.rejectedWith(LexicalProblem, { details: { path: 'dir' } }));
  });

  describe('directories', () => {
    it('should integrate implicit and explicit directories', () => lexing([
      { type: 'directory', path: 'nested' },
      { type: 'file', path: 'nested/directory/file', body: 'xyz' },
      { type: 'directory', path: 'nested/directory' }
    ]).then((archive) => {
      archive.should.eql(new Archive({
        nested: new Directory('nested', {
          directory: new Directory('nested/directory', {
            file: new File('nested/directory/file', 'xyz'),
          })
        })
      }));
    }));

    it('should create nested explicit directories', () => lexing([
      { type: 'directory', path: 'nested/directory/dir' }
    ]).then((archive) => {
      archive.should.eql(new Archive({
        nested: new Directory('nested', {
          directory: new Directory('nested/directory', {
            dir: new Directory('nested/directory/dir')
          })
        })
      }));
    }));

    it('should attach comments to directories', () => lexing([
      { type: 'comment', body: 'commentary' },
      { type: 'directory', path: 'dir' }
    ]).then((archive) => {
      archive.should.eql(new Archive({
        dir: new Directory('dir', null, 'commentary')
      }));
    }));

    it('should attach explicit comments to implicit directories', () => lexing([
      { type: 'file', path: 'dir/file', body: 'the file' },
      { type: 'comment', body: 'commentary' },
      { type: 'directory', path: 'dir' }
    ]).then((archive) => {
      archive.should.eql(new Archive({
        dir: new Directory('dir', {
          file: new File('dir/file', 'the file')
        }, 'commentary')
      }));
    }));

    it('should complain given duplicate explicit Directories', () => lexing([
      { type: 'directory', path: 'test.directory' },
      { type: 'directory', path: 'test.directory' }
    ]).should.be.rejectedWith(LexicalProblem, { details: { path: 'test.directory' } }));

    it('should complain if a Directory tries to overwrite a File', () => lexing([
      { type: 'file', path: 'test', body: 'test file' },
      { type: 'directory', path: 'test' }
    ]).should.be.rejectedWith(LexicalProblem, { details: { path: 'test' } }));
  });

  describe('archive', () => {
    it('should create an empty archive given no records', () => lexing([])
      .then((archive) => { archive.should.eql(new Archive()); }));

    it('should attach a stream-ending comment record to the archive', () => lexing([
      { type: 'directory', path: 'directory' },
      { type: 'comment', body: 'file comment' },
      { type: 'file', path: 'test.file', body: 'cool file' },
      { type: 'comment', body: 'archive comment' }
    ]).then((archive) => {
      archive.should.eql(new Archive({
        'directory': new Directory('directory'),
        'test.file': new File('test.file', 'cool file', 'file comment')
      }, 'archive comment'));
    }));
  });
});

