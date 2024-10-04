// cypress.config.js
const { defineConfig } = require('cypress');
const XLSX = require('xlsx'); // Ensure consistent naming
const fs = require('fs');
const path = require('path');

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // Task to read Excel file
      on('task', {
        readExcelFile({ filePath }) {
          const absolutePath = path.resolve(__dirname, filePath); // Get the absolute path to the Excel file
          const excelFileBuffer = fs.readFileSync(absolutePath); // Read the file
          const workbook = XLSX.read(excelFileBuffer, { type: 'buffer' }); // Read the workbook
          const sheetName = workbook.SheetNames[0]; // Get the first sheet name
          const sheet = workbook.Sheets[sheetName]; // Get the first sheet
          const jsonData = XLSX.utils.sheet_to_json(sheet); // Convert the sheet to JSON

          return jsonData; // Return the JSON data
        },
        // Task to write to Excel file
        writeExcelFile({ filePath, data }) {
          const worksheet = XLSX.utils.json_to_sheet(data); // Use the same variable name
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
          XLSX.writeFile(workbook, path.resolve(filePath));
          return null; // Indicate task completion
        }
      });

      return config; // Return the config object
    },
  },
});