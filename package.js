Package.describe({
  name: 'cfs-download-ddp',
  summary: 'CollectionFS, DDP File Download'
});

Package.on_use(function(api) {

  api.use([
    //CFS packages
    'cfs-base-package',
    'cfs-file',
    'cfs-ejson-file',
    //Core packages
    'deps',
    'underscore',
    'check',
    'livedata',
    'mongo-livedata',
    'ejson',
    //Other packages
    'power-queue',
    'reactive-list'
    ]);

  api.add_files([
    'download-ddp-client.js'
    ], 'client');

  api.add_files([
    'download-ddp-server.js'
    ], 'server');

});

Package.on_test(function (api) {
  api.use('collectionfs');
  api.use('test-helpers', 'server');
  api.use(['tinytest', 'underscore', 'ejson', 'ordered-dict',
   'random', 'deps']);

  api.add_files('tests/client-tests.js', 'client');
});
