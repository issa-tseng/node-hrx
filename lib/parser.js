'use strict';

const { Transform } = require('stream');
const { StringDecoder } = require('string_decoder');
const { PositionCounter } = require('./util/position');
const { ParseProblem } = require('./util/problem');

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
  let state = State.init, boundaryLen = 0, record, path, body;
  let lineStartBuffer, lineStartCtr;

  const startBody = () => {
    body = '';
    startBodyLine();
  };
  const startBodyLine = (pastFirstLine = false) => {
    lineStartBuffer = pastFirstLine ? '\n' : '';
    lineStartCtr = 0;
    state = State.bodyLineStart;
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
          if (boundaryLen === 0) {
            if (char === '<') {
              boundaryLen += 1;
            } else {
              return done(new ParseProblem('expected <, got ${char}', position.line, position.col));
            }
          } else if (boundaryLen > 0) {
            if (char === '=') {
              boundaryLen += 1;
            } else if (char === '>') {
              state = State.postboundary;
            } else {
              return done(new ParseProblem(`expected = or >, got "${char}"`, position.line, position.col));
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
            return done(new ParseProblem(`unexpected character "${char}"`, position.line, position.col));
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
              return done(new ParseProblem('unexpected newline', position.line, position.col));
            }
          } else if (!invalidPathChar(char)) {
            path += char;
          } else {
            return done(new ParseProblem(`unexpected character ${char}`, position.line, position.col));
          }

        } else if (state === State.bodyLineStart) {
          if ((lineStartCtr === 0) && (char === '<')) {
            lineStartBuffer += char;
            lineStartCtr += 1;
          } else if ((lineStartCtr < boundaryLen) && (char === '=')) {
            lineStartBuffer += char;
            lineStartCtr += 1;
          } else if ((lineStartCtr === boundaryLen) && (char === '>')) {
            completeRecord();
            this.push(record);
            state = State.postboundary;
          } else {
            body += lineStartBuffer + char;

            if (char === newline) {
              startBodyLine(true);
            } else {
              state = State.bodyLineConsume;
            }
          }

        } else if (state === State.bodyLineConsume) {
          if (char === newline) {
            startBodyLine(true);
          } else {
            body += char;
          }
        }
      }
      done();
    },
    flush(done) {
      if (state === State.bodyLineStart) body += lineStartBuffer;

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

