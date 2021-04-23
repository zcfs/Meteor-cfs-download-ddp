cfs-download-ddp
=========================

~~Looking for maintainers - please reach out!~~
This package is to be archived due to inability to find contributors, thanks to everyone who helped make it possible.

**If you're looking for an alternative, we highly recommend [Meteor-Files](https://github.com/VeliovGroup/Meteor-Files) by [VeliovGroup](https://github.com/VeliovGroup)**

---

This is a Meteor package that can be used with
[CollectionFS](https://github.com/zcfs/Meteor-CollectionFS).

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
