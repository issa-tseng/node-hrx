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
  describe('file start', () => {
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

    it('should recognize a correct boundary', () =>
      parsing('<====>\n').should.be.fulfilledWith([
        { type: 'comment', body: '', line: 2 }
      ]));

    it('should remember the expected boundary length', () =>
      parsing(`<==>\n<===>\n<====>\n<==>\n`).should.be.fulfilledWith([
        { type: 'comment', body: '<===>\n<====>', line: 4 },
        { type: 'comment', body: '', line: 5 }
      ]));
  });
});

