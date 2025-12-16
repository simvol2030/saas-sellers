// PM2 Ecosystem Configuration
// Production-ready setup for SvelteKit Telegram Mini App

module.exports = {
  apps: [{
    name: 'loyalty-telegram-app',
    script: './build/index.js',

    // Автозапуск при крашах
    autorestart: true,

    // Остановка при превышении памяти (защита от memory leaks)
    max_memory_restart: '500M',

    // Environment variables
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOST: '127.0.0.1'
    },

    // Загрузка переменных из .env файла
    env_file: './.env.production',

    // Cluster mode - используем все CPU ядра
    instances: 'max',
    exec_mode: 'cluster',

    // Graceful shutdown timeout
    kill_timeout: 5000,

    // Логи
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Restart limits (защита от бесконечных рестартов)
    max_restarts: 10,
    min_uptime: '10s',

    // Wait for ready signal (важно для zero-downtime deployment)
    wait_ready: true,
    listen_timeout: 10000,

    // Watch файлов (отключено в production)
    watch: false,

    // Ignore watch (если watch включен)
    ignore_watch: [
      'node_modules',
      'logs',
      '.git'
    ],

    // Cron restart (опционально, для периодических рестартов)
    // cron_restart: '0 4 * * *', // Рестарт каждый день в 4:00 AM

    // Graceful reload timeout
    shutdown_with_message: false
  }]
};
