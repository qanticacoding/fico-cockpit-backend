/**
 * PM2 Ecosystem Configuration
 * Gestione processo fico-cockpit-backend
 */

module.exports = {
  apps: [{
    name: 'fico-cockpit-backend',
    script: './index.js',
    
    // Opzioni runtime
    instances: 1,
    exec_mode: 'fork',
    
    // Auto restart
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 3456
    },
    
    // Logs
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Advanced features
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // Merge logs
    merge_logs: true,
    
    // Time to wait before force kill
    kill_timeout: 5000
  }]
};
