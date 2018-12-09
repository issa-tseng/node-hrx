const { Archive, Directory, File } = require('./data');
const { LexicalProblem } = require('./util/problem');

// TODO: again, stateful mutation hurts me.
const archiveFromRecordStream = (inStream) => new Promise((resolve, reject) => {
  const root = { path: '', contents: {} };
  let pendingComment = undefined;
  inStream.on('data', (record) => {
    if (record.type === 'comment') {
      // do nothing for now.
    } else {
      // figure out our object parent path and name.
      const pathComponents = record.path.split('/');
      const lastComponent = pathComponents.pop();

      // navigate up to but not including the target object. create directories
      // if necessary.
      let ptr = root;
      for (const component of pathComponents) {
        if (!ptr.contents.hasOwnProperty(component))
          ptr.contents[component] = { contents: {} };
        ptr = ptr.contents[component];
      }

      if (record.type === 'directory') {
        if (!ptr.contents.hasOwnProperty(lastComponent)) {
          // we have not seen this path before, implicitly or otherwise. create an record here.
          ptr.contents[lastComponent] = { path: record.path, contents: {}, comment: pendingComment, explicit: true };
        } else {
          // we have seen this path somehow. if it has already been explicitly declared fail it.
          const entry = ptr.contents[lastComponent];
          if (entry.explicit === true)
            return reject(new LexicalProblem(`duplicate directory at path ${record.path}`, record.line, record.col, { path: record.path }));

          // otherwise ensure that we have an explicit declaration and then attach a comment if we have one.
          entry.explicit = true;
          if (lastComment != null)
            ptr.contents[lastComponent].comment = pendingComment;
        }
      } else {
        if (ptr.contents.hasOwnProperty(lastComponent))
          // we already have this file, fail out.
          return reject(new LexicalProblem(`duplicate file at path ${record.path}`, record.line, record.col, { path: record.path }));

        // create a file record, with a comment if appropriate.
        ptr.contents[lastComponent] = new File(record.path, record.body, pendingComment)
      }
    }
    pendingComment = (record.type === 'comment') ? record.body : undefined;
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

