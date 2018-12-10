require('should');
const { Archive, Directory, File } = require('../lib/data');

describe('class', () => {
  describe('Archive/Directory', () => {
    describe('basics', () => {
      it('should be a directory', () => {
        (new Archive()).isDirectory().should.equal(true);
        (new Directory()).isDirectory().should.equal(true);
      });

      it('should not be a file', () => {
        (new Archive()).isFile().should.equal(false);
        (new Directory()).isFile().should.equal(false);
      });

      it('should remember its path', () => {
        (new Archive()).path.should.equal('');
        (new Directory('some/dir/path')).path.should.equal('some/dir/path');
      });

      it('should remember its comment', () => {
        (new Archive(null, 'test')).comment.should.equal('test');
        (new Directory('some/dir/path', null, 'test2')).comment.should.equal('test2');
      });

      it('should not remember any comment if not given one', () => {
        (new Archive()).hasOwnProperty('comment').should.equal(false);
        (new Directory('some/dir/path')).hasOwnProperty('comment').should.equal(false);
      });

      it('should be immutable', () => {
        const archive = new Archive();
        archive.test = 'value';
        should.not.exist(archive.test);

        archive.contents.test = 'value';
        should.not.exist(archive.contents.test);
      });
    });

    describe('deep getting', () => {
      it('should get a direct descendent', () => {
        (new Archive({ file: new File('file', 'some file') }))
          .get('file')
          .should.eql(new File('file', 'some file'));
      });

      it('should get a nested descendent directory', () => {
        (new Archive({
          directory: new Directory('directory', {
            nested: new Directory('directory/nested', {
              file: new File('file', 'some file')
            })
          })
        }))
          .get('directory/nested')
          .should.eql(new Directory('directory/nested', {
            file: new File('file', 'some file')
          }));
      });

      it('should get a nested descendent file', () => {
        (new Archive({
          directory: new Directory('directory', {
            nested: new Directory('nested', {
              file: new File('file', 'some file')
            })
          })
        }))
          .get('directory/nested/file')
          .should.eql(new File('file', 'some file'));
      });

      it('should fail to get a nonexistent subtree', () => {
        should.not.exist(
          (new Archive({ directory: new Directory('directory') }))
            .get('directory/nested/file'));
      });

      it('should fail to recurse into a file', () => {
        should.not.exist(
          (new Archive({
            directory: new Directory('directory', {
              nested: new File('file', 'a nested file')
            })
          })).get('directory/nested/file'));
      });
    });

    describe('listing/iterating', () => {
      it('should list empty contents', () => {
        (new Archive()).list().should.eql([]);
      });

      it('should list its contents', () => {
        (new Archive({
          a: new File('a'),
          b: new File('b'),
          c: new Directory('c')
        })).list().should.eql([ 'a', 'b', 'c' ]);
      });

      it('should iterate its contents', () => {
        const archive = new Archive({
          a: new File('a'),
          b: new File('b'),
          c: new Directory('c')
        });

        let expect = [ 'a', 'b', 'c' ];
        for (const filename of archive) {
          filename.should.equal(expect.shift());
        }
        expect.should.eql([]);
      });
    });
  });

  describe('File', () => {
    it('should not be a directory', () => {
      (new File()).isDirectory().should.equal(false);
    });

    it('should be a file', () => {
      (new File()).isFile().should.equal(true);
    });

    it('should remember its path', () => {
      (new File('some/nested/path.file')).path.should.equal('some/nested/path.file');
    });

    it('should remember its body', () => {
      (new File('', 'the body of the file')).body.should.equal('the body of the file');
    });

    it('should remember its comment', () => {
      (new File('', null, 'test')).comment.should.equal('test');
    });

    it('should not remember any comment if not given one', () => {
      (new File()).hasOwnProperty('comment').should.equal(false);
    });

    it('should be immutable', () => {
      const file = new File();
      file.test = 'value';
      should.not.exist(file.test);
    });
  });
});

