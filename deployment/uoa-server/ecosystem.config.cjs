module.exports = {
  apps: [
    {
      name: 'avatarcst-backend',
      cwd: '/home/rgin216/avatarcst-deploy/current/backend',
      script: 'src/server.js',
      interpreter: '/home/rgin216/.local/node-current/bin/node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      restart_delay: 3000,
      kill_timeout: 15000,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: '5000',
      },
    },
    {
      name: 'avatarcst-tunnel',
      script: '/usr/local/bin/cloudflared',
      interpreter: 'none',
      args: [
        'tunnel',
        '--no-autoupdate',
        '--url',
        'http://127.0.0.1:5000',
      ],
      autorestart: true,
      restart_delay: 5000,
      min_uptime: '10s',
      max_restarts: 20,
      time: true,
    },
  ],
};
