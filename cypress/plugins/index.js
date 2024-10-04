import './commands';  // Make sure commands.js is imported here
const { exec } = require('child_process');

module.exports = (on, config) => {
    on('task', {
        launchChromeWithExtension() {
            const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'; // Adjust if necessary
            const extensionPath = config.env.OMNIBUG_EXTENSION;
            const command = `"${chromePath}" --load-extension="${extensionPath}" --remote-debugging-port=9222`;

            exec(command, (err, stdout, stderr) => {
                if (err) {
                    console.error(`Error launching Chrome: ${stderr}`);
                    return;
                }
                console.log(stdout);
            });
            return null;
        }
    });
};
