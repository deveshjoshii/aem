const fs = require('fs');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');

module.exports = {
  e2e: {
    setupNodeEvents(on, config) {
      // Add Google Sheets and database tasks
      on('task', {
        readGoogleSheet({ range }) {
          const doc = new GoogleSpreadsheet('1_dfBa_dLSQDm4QqHUMIvrN9adNL6ga-lUGp4xFDNaqQ'); // Replace with your spreadsheet ID
          return new Promise(async (resolve, reject) => {
            try {
              await doc.useServiceAccountAuth(require('cypress/fixtures/credentials.json')); // Auth credentials file
              await doc.loadInfo();

              const sheet = doc.sheetsByTitle['Sheet2'];
              const rows = await sheet.getRows();

              const data = rows.map((row) => Object.values(row));
              resolve(data);
            } catch (error) {
              reject(error);
            }
          });
        },
        updateSheetAndDatabase(requestData) {
          return new Promise(async (resolve, reject) => {
            try {
              // Update Google Sheets
              const doc = new GoogleSpreadsheet('1_dfBa_dLSQDm4QqHUMIvrN9adNL6ga-lUGp4xFDNaqQ');
              await doc.useServiceAccountAuth(require('cypress/fixtures/credentials.json'));
              await doc.loadInfo();

              const sheet = doc.sheetsByTitle['Sheet2'];
              const rows = await sheet.getRows();

              rows.forEach((row, index) => {
                if (requestData[row.Fieldname]) {
                  row.Status = requestData[row.Fieldname].Status || 'Fail';
                  row.save();
                }
              });

              // Update database (pseudo-code for DB update)
              const db = require('./db'); // Your database connection
              Object.keys(requestData).forEach(async (fieldName) => {
                const status = requestData[fieldName]?.Status || 'Fail';
                await db.update('CapturedRequests', { Fieldname: fieldName }, { $set: { Status: status } });
              });

              resolve('Google Sheets and Database updated successfully!');
            } catch (error) {
              reject(error);
            }
          });
        },
      });
    },
  },
};
