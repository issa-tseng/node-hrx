require('should');
const { Readable } = require('stream');
const { fromChunks, toObjects } = require('streamtest').v2;
const { ParseProblem } = require('../lib/util/problem');
const { parseRecords } = require('../lib/parser');

// handling stream error/success muxing is annoying to do directly since pipe()
// doesn't pipe-forward error states. so this wrapper turns the operation into
// a Promise, where results are reject(Problem) or resolve([ Record ]).
const parsing = (input) => new Promise((resolve, reject) => {
  if (!Array.isArray(input)) input = [ input ];
  const outStream = parseRecords(fromChunks(input));
  outStream.on('error', reject);
  outStream.pipe(toObjects((_, result) => resolve(result)));
});

describe('parsing', () => {
  describe('initial boundary', () => {
    // we have to formulate our own stream here because streamtest doesn't work
    // so good with empty streams.
    // TODO: not sure how to construct this; given a true empty file the thing
    // seems to work as expected but i have trouble faking an empty stream.
    /*it('should not fail given an empty file', (done) => {
      const inStream = new Readable({ read() {} });
      outStream = parseRecords(inStream);

      outStream.on('error', () => { throw new Error('this should not be called'); });
      outStream.on('end', done);

      inStream.on('end', () => { console.log('aa'); });
      inStream.destroy();
    });*/

    it('should fail given anything but < at start', () =>
      parsing('x').should.be.rejectedWith(ParseProblem, { line: 1, col: 1 }));

    it('should fail if initial boundary ends too early', () =>
      parsing('<>').should.be.rejectedWith(ParseProblem, { line: 1, col: 2 }));

    it('should fail given anything but = in initial boundary', () => Promise.all([
      parsing('<x').should.be.rejectedWith(ParseProblem, { line: 1, col: 2 }),
      parsing('<=<').should.be.rejectedWith(ParseProblem, { line: 1, col: 3 }),
      parsing('<==\n').should.be.rejectedWith(ParseProblem, { line: 1, col: 4 })
    ]));

    it('should complain if the initial boundary never completes', () =>
      parsing('<==========').should.be.rejectedWith(ParseProblem, { line: 1, col: 12 }));

    it('should recognize a correct boundary', () =>
      parsing('<====>\n').should.be.fulfilledWith([
        { type: 'comment', body: '', line: 2 }
      ]));

    it('should remember the expected boundary length', () =>
      parsing('<==>\n<===>\n<====>\n<==>\n').should.be.fulfilledWith([
        { type: 'comment', body: '<===>\n<====>', line: 4 },
        { type: 'comment', body: '', line: 5 }
      ]));
  });

  describe('comment', () => {
    it('should detect and emit a comment', () =>
      parsing('<====>\ntest').should.be.fulfilledWith([
        { type: 'comment', body: 'test', line: 2 }
      ]));
  });

  describe('path', () => {
    it('should complain if newline comes too soon', () =>
      parsing('<=====> \n').should.be.rejectedWith(ParseProblem, {
        message: 'Parse Error: expected path, got newline (line 1 col 9)',
        line: 1, col: 9
      }));

    it('should complain if illegal characters are given', () => Promise.all([
      parsing('<=> x\u001ex').should.be.rejectedWith(ParseProblem, { col: 6 }),
      parsing('<=> x\u001fx').should.be.rejectedWith(ParseProblem, { col: 6 }),
      parsing('<=> x\u007fx').should.be.rejectedWith(ParseProblem, { col: 6 }),
      parsing('<=> x:x').should.be.rejectedWith(ParseProblem, { col: 6 }),
      parsing('<=> x\\x').should.be.rejectedWith(ParseProblem, { col: 6 }),
    ]));

    it('should complain if an empty path component is given', () =>
      parsing('<=> one/two//three').should.be.rejectedWith(ParseProblem, { col: 13 }));

    it('should complain if a . path component is given', () =>
      parsing('<=> one/two/./three').should.be.rejectedWith(ParseProblem, { col: 14 }));

    it('should complain if a .. path component is given', () =>
      parsing('<=> one/two/../three').should.be.rejectedWith(ParseProblem, { col: 15 }));

    it('should not complain if a ... path component is given', () =>
      parsing('<=> one/two/.../three\n').should.fulfilledWith([
        { type: 'file', path: 'one/two/.../three', body: '', line: 2 }
      ]));

    it('should complain if / is given as the path', () =>
      parsing('<=> /\n').should.be.rejectedWith(ParseProblem, { col: 5 }));

    it('should complain if / leads the path', () =>
      parsing('<=> /test\n').should.be.rejectedWith(ParseProblem, { col: 5 }));

    it('should recognize a root file', () =>
      parsing('<===> test\n').should.be.fulfilledWith([
        { type: 'file', path: 'test', body: '', line: 2 }
      ]));

    it('should recognize a root directory', () =>
      parsing('<===> test/\n').should.be.fulfilledWith([
        { type: 'directory', path: 'test/', line: 2 }
      ]));

    it('should recognize a nested file', () =>
      parsing('<===> nested/test\n').should.be.fulfilledWith([
        { type: 'file', path: 'nested/test', body: '', line: 2 }
      ]));

    it('should recognize a nested directory', () =>
      parsing('<===> nested/test/\n').should.be.fulfilledWith([
        { type: 'directory', path: 'nested/test/', line: 2 }
      ]));

    it('should ignore leading whitespace', () =>
      parsing('<===>     some/path/\n').should.be.fulfilledWith([
        { type: 'directory', path: 'some/path/', line: 2 }
      ]));
  });

  describe('body', () => {
    it('should include leading newlines', () =>
      parsing('<====>\n\ntest').should.be.fulfilledWith([
        { type: 'comment', body: '\ntest', line: 3 }
      ]));

    it('should include file-trailing newlines', () =>
      parsing('<====>\ntest\n').should.be.fulfilledWith([
        { type: 'comment', body: 'test\n', line: 3 }
      ]));

    it('should include intervening newlines', () =>
      parsing('<====>\ntest\ntest2\ntest3').should.be.fulfilledWith([
        { type: 'comment', body: 'test\ntest2\ntest3', line: 4 }
      ]));

    it('should ignore partial boundaries', () =>
      parsing('<====>\none\n<\n<=\n<==\n<===\n<====\n<>\n<=>\n<==>\n<===>>\ntwo').should.be.fulfilledWith([
        { type: 'comment', body: 'one\n<\n<=\n<==\n<===\n<====\n<>\n<=>\n<==>\n<===>>\ntwo', line: 12 }
      ]));

    it('should not drop content after seeing a partial boundary', () =>
      parsing('<====>\none\n<====a\n<===>b').should.be.fulfilledWith([
        { type: 'comment', body: 'one\n<====a\n<===>b', line: 4 }
      ]));

    it('should ignore overlong boundaries', () =>
      parsing('<====>\ntest\n<=====>test2').should.be.fulfilledWith([
        { type: 'comment', body: 'test\n<=====>test2', line: 3 }
      ]));

    it('should ignore boundaries not beginning the line', () =>
      parsing('<====>\ntest\ntest2<====> test3\ntest4').should.be.fulfilledWith([
        { type: 'comment', body: 'test\ntest2<====> test3\ntest4', line: 4 }
      ]));

    it('should recognize actual boundaries', () =>
      parsing('<====>\ntest\n<====>\ntest2').should.be.fulfilledWith([
        { type: 'comment', body: 'test', line: 3 },
        { type: 'comment', body: 'test2', line: 4 }
      ]));

    it('should include entry-trailing newlines', () =>
      parsing('<====>\ntest\n\n<====>\ntest2').should.be.fulfilledWith([
        { type: 'comment', body: 'test\n', line: 4 },
        { type: 'comment', body: 'test2', line: 5 }
      ]));

    it('should understand empty bodies', () =>
      parsing('<====> test\n<====> test2\n').should.be.fulfilledWith([
        { type: 'file', path: 'test', body: '', line: 2 },
        { type: 'file', path: 'test2', body: '', line: 3 }
      ]));
  });

  describe('end of file', () => {
    it('should include partial boundaries', () =>
      parsing('<====>\ntest\n<====').should.be.fulfilledWith([
        { type: 'comment', body: 'test\n<====', line: 3 }
      ]));

    it('should error on partial path', () => Promise.all([
      parsing('<===>\ntest\n<===> ').should.be.rejectedWith(ParseProblem, { line: 3 }),
      parsing('<===>\ntest\n<===> a').should.be.rejectedWith(ParseProblem, { line: 3 })
    ]));

    it('should error if initial boundary is never resolved', () =>
      parsing('<===>').should.be.rejectedWith(ParseProblem, { line: 1, col: 6 }));

    it('should error if non-initial boundary is never resolved', () =>
      parsing('<===> test\n<===>').should.be.rejectedWith(ParseProblem, { line: 2, col: 6 }));
  });
});

