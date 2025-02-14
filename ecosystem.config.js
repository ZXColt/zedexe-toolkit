module.exports = {
    apps: [
        {
            name: 'dl-api',
            script: 'index.js', // Replace with the entry point of your application
            instances: 'max', // Or a number of instances
            exec_mode: 'cluster', // Or 'fork' for single instance
            watch: true, // Watch for file changes and restart
            env: {
                NODE_ENV: 'development',
            },
            env_production: {
                NODE_ENV: 'production',
            },
        },
    ],
};