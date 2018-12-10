# node-hrx

A (currently read-only) implementation of the [HRX human-readable archive](https://github.com/google/hrx) format. It has zero runtime dependencies.

[![Build Status](https://img.shields.io/travis/clint-tseng/node-hrx.svg)](http://travis-ci.org/clint-tseng/node-hrx) [![NPM version](https://img.shields.io/npm/v/node-hrx.svg)](https://www.npmjs.com/package/node-hrx)

## usage

The package contains the following exports:

### `archiveFromStream(stream: Stream): Promise[Archive]`

Takes an input `stream` of HRX text and returns a `Promise[Archive]`. Parsing and lexical errors will result in a Promise rejection of `ParseError` and `LexicalError`, respectively.

Here is some sample code reading a file:

~~~ javascript
const { createReadStream } = require('fs');
const { archiveFromStream } = require('node-hrx');

archiveFromStream(createReadStream('path/to/file', 'utf8'))
  .then((archive) => { /* do successful things */ })
  .catch((error) => { /* do unsuccessful things */ });
~~~

### `Archive` and `Directory`

Archive and Directory are identical to each other, save that an Archive is meant to represent the root of an HRX Archive, and will never have a non-empty `path`. Both may have an attached comment and some File or Directory contents.

* `path: String`: the complete path to the directory from the archive root, without a trailing `/`. Archives always have a path of `''`.
* `contents: { name: File|Directory }`: a plain object containing directory contents keyed by relative name.
* `comment: String?`: the attached comment, if any.
* `get(path: String): (File|Directory)?`: given a relative path, possibly nested with `/`, returns the File or Directory entry at that path. If nothing exists there, `undefined` is returned.
* `list(): [String]`: returns a list of the File and Directory names within this Directory.
* `(iterator)`: you can use `for(const x of directory) { … }` iteration on Archive and Directory.
* `isDirectory() = true`: always returns true.
* `isFile() = false`: always returns false.

### `File`

File contains a path and a body. It may have an attached comment.

* `path: String`: the complete path to the file from the archive root.
* `body: String`: the body of the file.
* `comment: String?`: the attached comment, if any.
* `isDirectory() = false`: always returns false.
* `isFile() = true`: always returns true.

### `ParseError` and `LexicalError`

Subclasses of native `Error`. They contain additional error information at the properties `line` and `col`, and the subobject `details`.

LexicalErrors indicate only a `line` and no `col`. The given `line` is the line following the end of the record which is causing the problem.

Eventually, the possible errors may be more strongly-typed.

## testing

We use Mocha and should to test. You can invoke mocha directly, or run `npm test`.

## license

MIT. Also because I can't help it it's dual-licensed under WTFPL. If you contribute to this repository, you agree to have your contributions licensed in this way as well.

