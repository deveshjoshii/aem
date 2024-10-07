// cypress.config.js
const fs = require('fs');
const path = require('path');

module.exports = {
  // Other Cypress configuration options...
  e2e: {
    setupNodeEvents(on, config) {
      // Define the task to write to CSV
      on('task', {
        writeToCSV(data) {
          const filePath = path.join(__dirname, 'interceptedRequests.csv');
          const csvData = `${data}\n`;

          // Append the intercepted request URL to the CSV file
          fs.appendFileSync(filePath, csvData, 'utf8');
          return null; // Indicate success
        }
      });
    },
  },
};
