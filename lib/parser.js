'use strict';

const { Transform } = require('stream');
const { StringDecoder } = require('string_decoder');
const { PositionCounter } = require('./util/position');
const { ParseProblem } = require('./util/problem');

const State = {
  init: 1,
  postBoundary: 2,
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
// right now, we use a really primitive state machine with immediate local variables to
// minimize memory fragmentation as we read the input a character at a time.
//
// TODO: keep this silly state machine, or use an iteratee, or a real parser?
// TODO: obviously better error reporting.
const parseRecords = (inStream) => {
  const position = new PositionCounter();
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
    record.line = position.line;
    parserTransformer.push(record);
  };

  const decoder = new StringDecoder('utf8');
  const parserTransformer = new Transform({
    writableObjectMode: false, // bytes in
    readableObjectMode: true, // objects out
    transform(chunk, _, done) {
      for (const char of decoder.write(chunk)) {
        // in init state we just want to consume the initial boundary and count
        // how long it is for future reference:
        if (state === State.init) {
          if (boundaryLen === 0) {
            if (char === '<') {
              boundaryLen += 1;
            } else {
              return done(new ParseProblem(`expected <, got ${char}`, position));
            }
          } else if (boundaryLen > 0) {
            if (char === '=') {
              boundaryLen += 1;
            } else if (char === '>') {
              state = State.postBoundary;
            } else {
              return done(new ParseProblem(`expected = or >, got ${char}`, position));
            }
          }

        // postboundary, we will immediately go to file|directory or comment state:
        } else if (state === State.postBoundary) {
          if (char === ' ') {
            state = State.path;
            path = '';
          } else if (char === newline) {
            startBody();
            record = { type: 'comment' };
          } else {
            return done(new ParseProblem(`expected space or newline, got ${char}`, position));
          }

        // in path mode, we are reading the path, waiting for a newline, and then deciding
        // if we should create a file or a directory based on the path:
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
              return done(new ParseProblem('expected path, got newline', position));
            }
          } else if (!invalidPathChar(char)) {
            path += char;
          } else {
            return done(new ParseProblem(`illegal path character ${char}`, position));
          }

        // in bodyLineStart, we aren't yet sure if we might be reading a boundary. so we save
        // off what we see until we see a not-boundary, in which case we write everything we
        // saved, or else we get the whole boundary and we flush our current record and prepare
        // for a new one:
        } else if (state === State.bodyLineStart) {
          if ((lineStartCtr === 0) && (char === '<')) {
            lineStartBuffer += char;
            lineStartCtr += 1;
          } else if ((lineStartCtr < boundaryLen) && (char === '=')) {
            lineStartBuffer += char;
            lineStartCtr += 1;
          } else if ((lineStartCtr === boundaryLen) && (char === '>')) {
            completeRecord();
            state = State.postBoundary;
          } else {
            // here we see something that breaks with boundary; flush buffer and set new state:
            body += lineStartBuffer;

            if (char === newline) {
              startBodyLine(true);
            } else {
              body += char;
              state = State.bodyLineConsume;
            }
          }

        // in bodyLineConsume, we are already sure we don't have a boundary. so just write
        // everything we see to the body until we see a newline:
        } else if (state === State.bodyLineConsume) {
          if (char === newline) {
            startBodyLine(true);
          } else {
            body += char;
          }
        }

        // finally, no matter what we increment the position counter. we do this
        // at the end so that outputted errors are not offset in the incoming char.
        position.count(char);
      }
      done();
    },
    flush(done) {
      if (state === State.bodyLineStart)
        body += lineStartBuffer;

      if ((state === State.bodyLineStart) || (state === State.bodyLineConsume))
        completeRecord();

      done();
    }
  });

  return inStream.pipe(parserTransformer);
};

module.exports = { parseRecords };

