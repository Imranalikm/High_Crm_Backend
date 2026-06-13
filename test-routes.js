const app = require('./src/app');

app._router.stack.forEach(function(r){
  if (r.route && r.route.path){
    console.log(r.route.path)
  }
});

const apiRoutes = app._router.stack.find(s => s.regexp.toString().includes('api'));
if (apiRoutes && apiRoutes.handle && apiRoutes.handle.stack) {
  apiRoutes.handle.stack.forEach(function(r){
    console.log('API Sub route:', r.regexp, r.route ? r.route.path : 'nested router');
    if (r.name === 'router') {
      r.handle.stack.forEach(function(sub) {
        console.log('  ->', sub.route ? sub.route.path : 'nested');
      });
    }
  });
}
