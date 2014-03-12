var getMethodName = '/cfs/files/get';

/*
 * Download Transfer Queue
 */

var chunkSize = 0.5 * 1024 * 1024; // 0.5MB; can be changed
var cachedChunks = {};

/** @method DownloadTransferQueue
 * @constructor
 * @public
 * @param {Object} [options]
 * @param {Object} [options.connection=a separate connection to the default Meteor DDP URL] The connection to use
 */
DownloadTransferQueue = function downloadTransferQueueConstructor(options) {
  var self = this, name = 'DownloadTransferQueue';
  options = options || {};
  self.connection = options.connection || DDP.connect(Meteor.connection._stream.rawUrl);

  // Tie login for this connection to login for the main connection
  FS.Utility.connectionLogin(self.connection);

  self.queue = new PowerQueue({
    name: name
  });

  // Persistent but client-only collection
  self.collection = new Meteor.Collection(name, {connection: null});

  // Pass through some queue properties
  self.pause = self.queue.pause;
  self.resume = self.queue.resume;
  self.isPaused = self.queue.isPaused;
  self.isRunning = self.queue.isRunning;

};

/**
 * @method DownloadTransferQueue.prototype.downloadFile
 * @public
 * @param {FS.File} fsFile The file to download.
 * @param {String} [storeName] The store from which to download it.
 * @returns {undefined}
 *
 * Adds a chunked download request to the transfer queue. After being downloaded,
 * the browser will save the file like a normal download.
 */
DownloadTransferQueue.prototype.downloadFile = function dtqDownloadFile(fsFile, storeName) {
  var self = this;

  if (!(fsFile instanceof FS.File)) {
    throw new Error("downloadFile: Pass an FS.File instance as the first argument");
  }

  if (!fsFile.copies || _.isEmpty(fsFile.copies)) {
    throw new Error("downloadFile: No saved copies");
  }

  if (typeof storeName !== "string") {
    // do the best we can
    storeName = _.keys(fsFile.copies)[0];
  }

  var copyInfo = fsFile.copies[storeName];
  if (!copyInfo) {
    throw new Error('TransferQueue download failed: no info for store ' + storeName);
  }

  var size = copyInfo.size;

  if (typeof size !== 'number') {
    throw new Error('TransferQueue download failed: fsFile size not set for store ' + storeName);
  }

  // Prep the chunk cache
  cachedChunks[fsFile.collectionName] = cachedChunks[fsFile.collectionName] || {};
  cachedChunks[fsFile.collectionName][fsFile._id] = cachedChunks[fsFile.collectionName][fsFile._id] || {};
  cachedChunks[fsFile.collectionName][fsFile._id][storeName] = cachedChunks[fsFile.collectionName][fsFile._id][storeName] || {count: 0, data: null};

  // Download via DDP
  for (var chunk = 0, chunks = Math.ceil(size / chunkSize); chunk < chunks; chunk++) {
    var start = chunk * chunkSize;
    Meteor.setTimeout(function(tQueue, fsFile, storeName, start) {
      return function() {
        downloadChunk(tQueue, fsFile, storeName, start);
      };
    }(self, fsFile, storeName, start), 0);
  }
};

/**
 * @method DownloadTransferQueue.prototype.progress
 * @public
 * @param {FS.File} fsFile The file
 * @param {String} storeName The name of the store to retrieve from
 * @returns {Number} Progress percentage
 *
 * Reactive status percent for the queue in total or a specific file
 */
DownloadTransferQueue.prototype.progress = function dtqProgress(fsFile, storeName) {
  var self = this;
  if (fsFile) {
    if (typeof storeName !== "string") {
      throw new Error("DownloadTransferQueue progress requires storeName");
    }
    var totalChunks = Math.ceil(fsFile.size / chunkSize);
    var downloadedChunks = self.collection.find({fileId: fsFile._id, collectionName: fsFile.collectionName, storeName: storeName, data: true}).count();
    return Math.round(downloadedChunks / totalChunks * 100);
  } else {
    return self.queue.progress();
  }
};

/**
 * @method DownloadTransferQueue.prototype.cancel
 * @public
 * @returns {undefined}
 *
 * Cancel all downloads.
 */
DownloadTransferQueue.prototype.cancel = function dtqCancel() {
  var self = this;
  self.queue.reset();
  self.collection.remove({});
};

/**
 * @method DownloadTransferQueue.prototype.isDownloadingFile
 * @public
 * @param {FS.File} fsFile
 * @param {String} storeName
 * @returns {Boolean} Are we currently downloading this file from this store?
 *
 * Determines whether we are currently downloading this file from this store.
 */
DownloadTransferQueue.prototype.isDownloadingFile = function dtqIsDownloadingFile(fsFile, storeName) {
  var self = this;
  if (typeof storeName !== "string" && fsFile.isMounted()) {
    storeName = fsFile.collection.options.defaultStoreName || null;
  }
  return !!self.collection.findOne({fileId: fsFile._id, collectionName: fsFile.collectionName, storeName: storeName});
};

/**
 * @method cacheDownload
 * @private
 * @param {Meteor.Collection} col
 * @param {FS.File} fsFile
 * @param {String} storeName
 * @param {Number} start
 * @param {Function} callback
 * @returns {undefined}
 */
function cacheDownload(col, fsFile, storeName, start, callback) {
  if (col.findOne({fileId: fsFile._id, collectionName: fsFile.collectionName, storeName: storeName, start: start})) {
    // If already cached, don't do it again
    callback();
  } else {
    col.insert({fileId: fsFile._id, collectionName: fsFile.collectionName, storeName: storeName, start: start}, callback);
  }
}

/**
 * @method unCacheDownload
 * @private
 * @param {Meteor.Collection} col
 * @param {FS.File} fsFile
 * @param {String} storeName
 * @param {Function} callback
 * @returns {undefined}
 */
function unCacheDownload(col, fsFile, storeName, callback) {
  delete cachedChunks[fsFile.collectionName][fsFile._id][storeName];
  col.remove({fileId: fsFile._id, collectionName: fsFile.collectionName, storeName: storeName}, callback);
}

/**
 * @method downloadChunk
 * @private
 * @param {TransferQueue} tQueue
 * @param {FS.File} fsFile
 * @param {String} storeName
 * @param {Number} start
 * @returns {undefined}
 *
 * Downloading is a bit different from uploading. We cache data as it comes back
 * rather than before making the method calls.
 */
function downloadChunk(tQueue, fsFile, storeName, start) {
  if (fsFile.isMounted()) {

    cacheDownload(tQueue.collection, fsFile, storeName, start, function(err) {
      tQueue.queue.add(function(complete) {
        FS.debug && console.log("downloading bytes starting from " + start);
        //tQueue.connection.apply(getMethodName,
        //XXX using Meteor.apply for now because login isn't working
        Meteor.apply(getMethodName,
                [fsFile, storeName, start, start + chunkSize],
                {
                  onResultReceived: function(err, data) {
                    if (err) {
                      complete();
                      throw err;
                    } else {
                      addDownloadedData(tQueue.collection, fsFile, storeName, start, data, function(err) {
                        complete();
                      });
                    }
                  }
                });
      });
    });

  }

}

/**
 * @method addDownloadedData
 * @private
 * @param {Meteor.Collection} col
 * @param {FS.File} fsFile
 * @param {String} storeName
 * @param {Number} start
 * @param {Uint8Array} data
 * @param {Function} callback
 * @returns {undefined}
 */
function addDownloadedData(col, fsFile, storeName, start, data, callback) {
  col.update({fileId: fsFile._id, collectionName: fsFile.collectionName, storeName: storeName, start: start}, {$set: {data: true}}, function(err) {
    if (err) {
      callback(err);
      return;
    }

    // Save chunk into temp binary object.
    // We could cache data in the tracking collection, but currently
    // minimongo clones everything, which results in double memory consumption
    // and much slower downloads.
    var totalChunks = Math.ceil(fsFile.size / chunkSize);
    var cnt = cachedChunks[fsFile.collectionName][fsFile._id][storeName]["count"] += 1;
    var bin = cachedChunks[fsFile.collectionName][fsFile._id][storeName]["data"] = cachedChunks[fsFile.collectionName][fsFile._id][storeName]["data"] || EJSON.newBinary(fsFile.size);
    for (var i = 0, ln = data.length, r = start; i < ln; i++) {
      bin[r] = data[i];
      r++;
    }
    if (totalChunks === cnt) {
      // All chunks have been downloaded into the cache
      // Save combined data
      fsFile.attachData(bin);
      fsFile.data.saveAs(fsFile.copies[storeName].name);
      // Now that we've saved it, clear the cache
      unCacheDownload(col, fsFile, storeName, callback);
    } else {
      callback();
    }
  });
}

/**
 * @namespace FS
 * @public
 * @type DownloadTransferQueue
 *
 * There is a single downloads transfer queue per client (not per CFS)
 */
FS.downloadQueue = new DownloadTransferQueue();
