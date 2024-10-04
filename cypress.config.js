const { exec } = require('child_process');
const fs = require('fs');

module.exports = {
    e2e: {
        downloadsFolder: 'cypress/downloads',
        setupNodeEvents(on, config) {
            on('task', {
                launchChromeWithExtension() {
                    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'; // Adjust if necessary
                    const extensionPath = config.env.OMNIBUG_EXTENSION;
                    const command = `"${chromePath}" --load-extension="${extensionPath}" --remote-debugging-port=9222`;
                    exec(command, (err) => {
                        if (err) {
                            console.error(`Error launching Chrome: ${err}`);
                        }
                    });
                    return null;
                },
                writeToCSV({ filePath, data }) {
                    return new Promise((resolve, reject) => {
                        const csvData = data.join('\n') + '\n'; // Convert array to CSV format
                        fs.appendFile(filePath, csvData, (err) => {
                            if (err) {
                                console.error(`Error writing to CSV: ${err}`);
                                reject(err);
                            } else {
                                resolve(null);
                            }
                        });
                    });
                },
                closeBrowser() {
                    return new Promise((resolve) => {
                        exec('taskkill /F /IM chrome.exe', (err) => {
                            if (err) {
                                console.error(`Error closing Chrome: ${err}`);
                            } else {
                                console.log('Chrome closed successfully');
                            }
                            resolve(null);
                        });
                    });
                }
            });
        },
        chromeWebSecurity: false,
        env: {
            OMNIBUG_EXTENSION: "C:\\Users\\devesh.joshi\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Extensions\\bknpehncffejahipceakbfkomebjmokl\\2.0.2_0"
        }
    }
};
