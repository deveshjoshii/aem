// Import necessary libraries
const fs = require('fs');
const Papa = require('papaparse');

describe('Intercept request, stringify, and decode key-value pairs', () => {
  it('Processes multiple URLs from aemdata.csv and checks values', () => {
    const aemDataFilePath = 'cypress/fixtures/aemdata.csv'; // AEM data CSV file path
    const outputFilePath = 'cypress/fixtures/output.csv'; // Output CSV file path

    // Read AEM data to get the URLs
    cy.readFile(aemDataFilePath).then((fileContent) => {
      const aemData = Papa.parse(fileContent, { header: true }).data;

      // Iterate over each row in the AEM data
      aemData.forEach((row, index) => {
        const urlToVisit = row.Url; // Assuming the URL is in the 'Url' column

        // Visit the page
        cy.visit(urlToVisit);

        // Intercept the request containing "/b/ss/"
        cy.intercept('GET', '**/b/ss/**').as('specificRequest');

        // Wait for the intercepted request
        cy.wait('@specificRequest', { timeout: 10000 }).then((interception) => {
          // Get the intercepted URL
          const interceptedUrl = interception.request.url;

          // Extract the query string
          const queryString = interceptedUrl.split('?')[1]; // Get everything after "?"
          const decodedQuery = decodeURIComponent(queryString);
          const keyValuePairs = decodedQuery.split('&');

          // Create an object to store key-value pairs
          const extractedData = {};
          keyValuePairs.forEach(pair => {
            const [key, value] = pair.split('=');
            extractedData[key] = value || '';  // Store the key-value pair in the object
          });

          // Log extracted variables for debugging
          cy.log('Extracted Variables:', extractedData);
          console.log('Extracted Variables:', extractedData); // Log to console for better visibility

          // Write extracted data to output CSV
          const outputHeader = Object.keys(extractedData).join(',') + '\n';
          const outputRow = Object.values(extractedData).join(',') + '\n';
          cy.task('writeToCSV', outputHeader + outputRow, { filePath: outputFilePath });

          // Define the header keys including prop22
          const headerKeys = [
            'ce', 'cc', 'g', 'v', 'mid', 'pageName', 'rs', 'server', 't', 'ns',
            'c3', 'c4', 'c10', 'c19', 'c24', 'c30', 'c31', 'c38', 'c46', 'c48',
            'c49', 'c56', 'c57', 'c58', 'c75', 'v22', 'v27', 'v41', 'v45', 'v60',
            'v61', 'v74', 'v75', 'v94', 'v122', 'v140', 'h1', 'ssf', 'lob', 
            'visitorCheck', 'bh', 't', 'bw', 'cl', 'c', 'j', 'mcorgid', 'pf', 
            'c3', 's', 'prop22'
          ];

          // Create an object to hold the final data using the header keys
          const finalData = {};
          headerKeys.forEach(key => {
            finalData[key] = extractedData[key] || '';  // Assign the value from extractedData if it exists
          });

          // Log final data to verify the values before writing to CSV
          cy.log('Final Data:', finalData);
          console.log('Final Data:', finalData); // Log to console for better visibility

          // Compare values with AEM data
          const fieldName = row.Fieldname; // Assuming the field name is in the 'Fieldname' column
          const expectedValue = row.Value; // Assuming the expected value is in the 'Value' column

          // Check if the finalData contains the field name
          if (finalData[fieldName] !== undefined) {
            // Use trim and toLowerCase for comparison
            const extractedValue = finalData[fieldName].trim().toLowerCase();
            const expectedValueTrimmed = expectedValue.trim().toLowerCase();

            if (extractedValue === expectedValueTrimmed) {
              row.Status = 'Pass';
            } else {
              row.Status = 'Fail';
            }
          }

          // Write updated AEM data back to the CSV file
          const updatedAemData = Papa.unparse(aemData);
          cy.writeFile(aemDataFilePath, updatedAemData);
        });

        // Optionally, close the browser after the request
        cy.window().then((win) => {
          win.close();
        });
      });
    });
  });
});