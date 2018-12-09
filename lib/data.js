
class Archive {
  constructor(root, comment) {
    this.root = root;
    this.comment = comment;
  }
}

class Directory {
  constructor(path, contents, comment) {
    this.path = path;
    this.contents = contents;
    this.comment = comment;
    Object.freeze(this);
    Object.freeze(this.contents);
  }
  isDirectory() { return true; }
  isFile() { return false; }
  [Symbol.iterator]() { return Object.keys(this.contents)[Symbol.iterator](); }
}

class File {
  constructor(path, body, comment) {
    this.path = path;
    this.body = body;
    this.comment = comment;
    Object.freeze(this);
  }
  isDirectory() { return false; }
  isFile() { return true; }
}

module.exports = { Archive, Directory, File };

