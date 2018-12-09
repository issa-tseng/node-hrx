const { Archive, Directory, File } = require('./data');
const { LexicalProblem } = require('./util/problem');

// TODO: again, stateful mutation hurts me.
const archiveFromRecordStream = (inStream) => new Promise((resolve, reject) => {
  const root = { path: '', contents: {} };
  let pendingComment = undefined;
  inStream.on('data', (record) => {
    if (record.type === 'comment') {
      // just record that we have a pending comment, then bail:
      pendingComment = record.body;
      return;
    }

    // otherwise we have a file or a directory. either way, some common tasks first:
    // figure out our object parent path and name.
    const pathComponents = record.path.split('/');
    const lastComponent = pathComponents.pop();

    // navigate up to but not including the target object. create directories if necessary.
    let ptr = root;
    for (const component of pathComponents) {
      if (!ptr.contents.hasOwnProperty(component))
        ptr.contents[component] = { contents: {} };
      ptr = ptr.contents[component];
    }

    if (record.type === 'directory') {
      // if we have not seen this path before, create a directory record:
      if (!ptr.contents.hasOwnProperty(lastComponent))
        ptr.contents[lastComponent] = { contents: {} };
      const directory = ptr.contents[lastComponent];

      // if we have already seen this path explicitly, fail out, otherwise mark explicit:
      if (directory.explicit === true)
        return reject(new LexicalProblem(`duplicate directory at path ${record.path}`, record.line, record.col, { path: record.path }));
      directory.explicit = true;

      // finally, attach a comment if one is pending.
      if (pendingComment != null) directory.comment = pendingComment;

    } else { // we have a file.

      if (ptr.contents.hasOwnProperty(lastComponent))
        // we already have this file, fail out.
        return reject(new LexicalProblem(`duplicate file at path ${record.path}`, record.line, record.col, { path: record.path }));

      // create a file record, with a comment if appropriate.
      ptr.contents[lastComponent] = new File(record.path, record.body, pendingComment)
    }

    // blow away the pending comment.
    pendingComment = null;
  });
  inStream.on('error', reject);
  inStream.on('end', () => {
    // go through the temporary working tree and create immutable directory structure.
    // we have to do this leaves-out.
    const reify = (data, prefix = []) => {
      const contents = {}; // TODO: ugh poor name.
      for (const key of Object.keys(data.contents)) {
        const object = data.contents[key];
        if (object instanceof File)
          contents[key] = object
        else
          contents[key] = reify(object, prefix.concat([ key ]));
      }
      return new Directory(prefix.join('/'), contents, data.comment);
    };

    // return the final archive object.
    resolve(new Archive(reify(root), pendingComment));
  });
});

module.exports = { archiveFromRecordStream };

