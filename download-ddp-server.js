Meteor.methods({
  '/cfs/files/get': function CfsDdpDownload(fileObj, storeName, start, end) {
    var self = this;
    check(fileObj, FS.File);
    check(storeName, String);
    check(start, Match.Optional(Number));
    check(end, Match.Optional(Number));

    self.unblock();

    fileObj.getCollection(); // We can then call fileObj.collection

    FS.Utility.validateAction(fileObj.collection._validators['download'], fileObj, self.userId);

    return fileObj.get({
      storeName: storeName,
      start: start,
      end: end
    });
  }
});
