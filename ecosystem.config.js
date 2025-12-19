module.exports = {
  apps: [
    {
      name: 'saas-sellers-backend',
      cwd: '/opt/websites/saas.mix-id.ru/backend-hono',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3008
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      error_file: '../data/logs/backend-error.log',
      out_file: '../data/logs/backend-out.log',
      time: true
    },
    {
      name: 'saas-sellers-frontend',
      cwd: '/opt/websites/saas.mix-id.ru/frontend-astro',
      script: 'server.mjs',
      env: {
        NODE_ENV: 'production',
        PORT: 3017
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      error_file: '../data/logs/frontend-error.log',
      out_file: '../data/logs/frontend-out.log',
      time: true
    }
  ]
};
