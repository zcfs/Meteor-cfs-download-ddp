cfs-download-ddp
=========================

This is a Meteor package that can be used with
[CollectionFS](https://github.com/CollectionFS/Meteor-CollectionFS).

We recommend simply downloading over HTTP using the URL returned by
`FS.File.prototype.url` when you set the `download` option to true. However,
if you wish to do chunked downloads over DDP, that's what this package is for.