const { Archive, Directory, File } = require('./data');

// TODO: again, stateful mutation hurts me.
const archiveFromRecordStream = (inStream) => new Promise((resolve, reject) => {
  const root = { contents: {} };
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
        // create a directory only if we must. attach a comment if we just saw one.
        if (!ptr.contents.hasOwnProperty(lastComponent))
          ptr.contents[lastComponent] = { path: record.path, contents: {}, comment: pendingComment };
        else if (lastComment != null)
          ptr.contents[lastComponent].comment = pendingComment;
      } else {
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
    const reify = (data) => {
      const contents = {}; // TODO: ugh poor name.
      for (const key of Object.keys(data.contents)) {
        const object = data.contents[key];
        if (object instanceof File)
          contents[key] = object
        else
          contents[key] = reify(object);
      }
      return new Directory(data.path, contents, data.comment);
    };

    // return the final archive object.
    resolve(new Archive(reify(root), pendingComment));
  });
});

module.exports = { archiveFromRecordStream };

