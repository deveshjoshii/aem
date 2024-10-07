const fs = require('fs');
const path = require('path');

module.exports = (on, config) => {
    on('task', {
        writeToCSV(data) {
            const filePath = path.join(__dirname, 'output.csv'); // Set your desired file path
            return new Promise((resolve, reject) => {
                fs.appendFile(filePath, data, (err) => {
                    if (err) reject(err);
                    else resolve(null);
                });
            });
        }
    });
};
