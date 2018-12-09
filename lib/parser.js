'use strict';

const { Transform } = require('stream');
const { StringDecoder } = require('string_decoder');
const { PositionCounter } = require('./util/position');

const State = {
  init: 1,
  postboundary: 2,
  path: 3,
  bodyLineStart: 4,
  bodyLineConsume: 5
};
Object.freeze(State);

const last = (str) => str[str.length - 1];

const newline = '\u000a';
const invalidPathChar = (char) =>
  (char <= '\u001f') ||
  (char === '\u007f') || (char === '\u003a') || (char === '\u005c');

// puts out a stream of these records:
// { type: 'comment|file|directory', path: String?, body: String? }
//
// TODO: keep this silly state machine, or use an iteratee, or a real parser?
// TODO: obviously better error reporting.
const parseRecords = (inStream) => {
  const counter = new PositionCounter();
  let state = State.init, boundaryCtr = 0, record, path, body;
  let bodyBoundaryCtr;

  const startBody = () => {
    body = '';
    startBodyLine();
  };
  const startBodyLine = () => {
    state = State.bodyLineStart;
    bodyBoundaryCtr = 0;
  };

  const writeFailedBoundary = () => {
    if (bodyBoundaryCtr === 0) return;

    // TODO: preformulate and slice for perf?
    body += '<';
    for (let i = 1; i < bodyBoundaryCtr; i++) body += '=';
  };
  const completeRecord = () => {
    if (record.type !== 'directory') record.body = body;
    record.line = counter.line;
    record.col = counter.col;
  };

  const decoder = new StringDecoder('utf8');
  const parserTransformer = new Transform({
    writableObjectMode: false, // bytes in
    readableObjectMode: true, // objects out
    transform(chunk, _, done) {
      for (const char of decoder.write(chunk)) {
        counter.count(char);

        if (state === State.init) {
          if (boundaryCtr === 0) {
            if (char === '<') {
              boundaryCtr += 1;
            } else {
              return done(new Error('expected "<" at start of file'));
            }
          } else if (boundaryCtr > 0) {
            if (char === '=') {
              boundaryCtr += 1;
            } else if (char === '>') {
              state = State.postboundary;
            } else {
              return done(new Error(`unexpected character "${char}"`));
            }
          }

        } else if (state === State.postboundary) {
          if (char === ' ') {
            state = State.path;
            path = '';
          } else if (char === newline) {
            startBody();
            record = { type: 'comment' };
          } else {
            return done(new Error(`unexpected character "${char} at ${counter}"`));
          }

        } else if (state === State.path) {
          if ((char === ' ') && (path.length === 0)) {
            // do nothing; consume prepath whitespace.
          } else if (char === newline) {
            if (last(path) === '/') {
              startBody();
              record = { type: 'directory', path };
              // TODO: can't actually cheat this way
            } else if (path.length > 0) {
              startBody();
              record = { type: 'file', path };
            } else {
              return done(new Error('unexpected newline at ' + counter));
            }
          } else if (!invalidPathChar(char)) {
            path += char;
          } else {
            return done(new Error(`unexpected character ${char} at ${counter}`));
          }

        } else if (state === State.bodyLineStart) {
          if (((bodyBoundaryCtr === 0) && (char === '<')) ||
            ((bodyBoundaryCtr < boundaryCtr) && (char === '='))) {
            bodyBoundaryCtr += 1;
          } else if ((bodyBoundaryCtr === boundaryCtr) && (char === '>')) {
            completeRecord();
            this.push(record);
            state = State.postboundary;
          } else {
            if (body.length > 0) body += '\n'; // TODO: inelegant
            writeFailedBoundary();
            body += char;

            if (char === newline)
              startBodyLine();
            else
              state = State.bodyLineConsume;
          }

        } else if (state === State.bodyLineConsume) {
          if (char === newline) {
            startBodyLine();
          } else {
            body += char;
          }
        }
      }
      done();
    },
    flush(done) {
      if ((state === State.bodyLineStart) && (bodyBoundaryCtr > 0))
        writeFailedBoundary();

      if ((state === State.bodyLineStart) || (state === State.bodyLineConsume)) {
        completeRecord();
        this.push(record);
      }

      done();
    }
  });

  return inStream.pipe(parserTransformer);
};

module.exports = { parseRecords };

