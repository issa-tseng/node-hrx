
const recurse = (ptr, path) => {
  const parts = path.split('/');
  for (const part of parts) {
    if (!(ptr instanceof Directory) || !ptr.contents.hasOwnProperty(part))
      return undefined;
    ptr = ptr.contents[part];
  }
  return ptr;
};

class Archive {
  constructor(root, comment) {
    this.root = root;
    if (comment != null) this.comment = comment;

    Object.freeze(this);
  }

  get(path) { return recurse(this.root, path); }
}

class Directory {
  constructor(path, contents, comment) {
    this.path = path;
    this.contents = contents;
    if (comment != null) this.comment = comment;

    Object.freeze(this);
    Object.freeze(this.contents);
  }
  isDirectory() { return true; }
  isFile() { return false; }

  get(path) { return recurse(this, path); }

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

module.exports = { Archive, Directory, File };

