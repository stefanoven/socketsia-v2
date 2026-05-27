module.exports = {
  apps: [{
    name: 'socketsia-v2',
    script: 'src/main.js',
    cwd: '/opt/socketsia-v2/backend',
    instances: 1,            // NON usare cluster: il server TCP e l'eventBus
    autorestart: true,       // condividono stato in-memory
    watch: false,
    max_memory_restart: '512M',
    env_production: {
      NODE_ENV: 'production',
    },
  }],
};
