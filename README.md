cfs-download-ddp
=========================

This is a Meteor package that can be used with
[CollectionFS](https://github.com/CollectionFS/Meteor-CollectionFS).

We recommend simply downloading over HTTP using the URL returned by
`FS.File.prototype.url` when you set the `download` option to true. However,
if you wish to do chunked downloads over DDP, that's what this package is for.

## Custom Connection

To use a custom DDP connection for downloads, override the default
transfer queue with your own, passing in your custom connection:

```js
if (Meteor.isClient) {
  // There is a single uploads transfer queue per client (not per FS.Collection)
  FS.downloadQueue = new DownloadTransferQueue({ connection: DDP.connect(myUrl) });
}
```
