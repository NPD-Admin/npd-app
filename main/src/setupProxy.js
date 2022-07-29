const { createProxyMiddleware } = require('http-proxy-middleware');

const filter = (pathname, req) => ![
  '/',
  '/static/js/bundle.js',
  '/manifest.json',
  '/static/media/logo.6ce24c58023cc2f8fd88fe9d219db6c6.svg',
  '/logo192.png'
].includes(pathname);
module.exports = app => {
  app.use(
    createProxyMiddleware(filter, {
      target: 'http://localhost:5000',
      secure: false,
      changeOrigin: true,

    })
  );
}