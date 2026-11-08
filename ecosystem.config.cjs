// pm2: mantiene el bot encendido 24/7 y lo reinicia si se cae.
//   pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: 'massup',
      script: 'dist/index.js',
      cwd: __dirname,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '500M',
      restart_delay: 5000,
      time: true,
    },
  ],
};
