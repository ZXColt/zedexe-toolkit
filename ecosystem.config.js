module.exports = {
    apps: [
        {
            name: 'zedexe-toolkit',
            script: 'src/index.js', // Replace with the entry point of your application
            instances: 1, // Run a single instance
            exec_mode: 'fork', // Use 'fork' for single instance
            watch: false, // Watch for file changes and restart
            env: {
                NODE_ENV: 'development',
            },
            env_production: {
                NODE_ENV: 'production',
            },
        },
    ],
};