
class Directory {
  constructor(path, contents, comment) {
    if (path != null) this.path = path;
    this.contents = contents || {};
    if (comment != null) this.comment = comment;

    Object.freeze(this);
    Object.freeze(this.contents);
  }
  isDirectory() { return true; }
  isFile() { return false; }

  get(path) {
    let ptr = this;
    const parts = path.split('/');
    for (const part of parts) {
      if (!(ptr instanceof Directory) || !ptr.contents.hasOwnProperty(part))
        return undefined;
      ptr = ptr.contents[part];
    }
    return ptr;
  }

  list() { return Object.keys(this.contents); }
  [Symbol.iterator]() { return Object.keys(this.contents)[Symbol.iterator](); }
}

class File {
  constructor(path, body, comment) {
    this.path = path;
    this.body = body;
    if (comment != null) this.comment = comment;

    Object.freeze(this);
  }
  isDirectory() { return false; }
  isFile() { return true; }
}

class Archive extends Directory {
  constructor(contents, comment) {
    super('', contents, comment);
  }
}

module.exports = { Archive, Directory, File };

