// Import necessary libraries
const fs = require('fs');
const Papa = require('papaparse');

describe('Intercept request, perform actions, and process values', () => {
  beforeEach(() => {
    // Catch uncaught exceptions to prevent test failure
    Cypress.on('uncaught:exception', (err) => {
      if (err.message.includes('digitalData.event is undefined')) {
        cy.log('Caught uncaught exception: ' + err.message);
        return false; // Prevents Cypress from failing the test
      }
    });
  });

  it('Processes multiple URLs from aemdata.csv, performs actions, and checks values', () => {
    const aemDataFilePath = 'cypress/fixtures/aemdata.csv'; // AEM data CSV file path
    const outputFilePath = 'cypress/fixtures/output.csv'; // Output CSV file path

    // Read AEM data to get the URLs
    cy.readFile(aemDataFilePath).then((fileContent) => {
      const aemData = Papa.parse(fileContent, { header: true }).data;

      // Process each row asynchronously
      cy.wrap(aemData).each((row) => {
        const urlToVisit = row.Url; // Assuming the URL is in the 'Url' column
        const action = row.Action; // Assuming the action is in the 'Action' column

        // Check if the URL is not empty before visiting
        if (urlToVisit) {
          // Visit the page
          cy.visit(urlToVisit).then(() => {
            // If action is null or empty
            if (!action) {
              cy.log(`No action provided. Fetching request for URL: ${urlToVisit}`);

              // Intercept the request after the URL visit
              cy.intercept('GET', '**/b/ss/**').as('specificRequest'); // Adjust the intercept pattern as needed

              // Wait for the intercepted request after visiting the URL
              return cy.wait('@specificRequest', { timeout: 10000 }).then((interception) => {
                processInterceptedRequest(interception, row, aemData, aemDataFilePath, outputFilePath);
              });
            } else if (action && action.includes('|')) {
              const [actionType, objectLocator] = action.split('|');
              const valueToType = row.Value; // Assuming there's a 'Value' column for typing

              if (actionType === 'click') {
                cy.get(objectLocator)
                  .should('be.visible')
                  // .should('be.enabled')
                  .click()
                  .then(() => {
                    cy.log(`Clicked on element: ${objectLocator}`);
                    // Wait for the URL to change after the click
                    cy.wait(1000)
                    cy.get(objectLocator).click()
                    

                    // Intercept the request after the action has been performed
                    // cy.intercept('GET', '**/b/ss/**v5**').as('specificRequest');
                    cy.intercept({
                      method: 'GET',
                      url: '**/b/ss/**', // Match any URL that contains /b/ss
                      query: {
                        v5: '**', // Ensure v5 is present as a query parameter
                      },
                    }).as('specificRequest');
                    

                    // Wait for the intercepted request after the action
                    return cy.wait('@specificRequest', { timeout: 10000 }).then((interception) => {
                      processInterceptedRequest(interception, row, aemData, aemDataFilePath, outputFilePath);
                    });
                  });
              } else if (actionType === 'type') {
                cy.get(objectLocator)
                  .should('be.visible')
                  .type(valueToType)
                  .then(() => {
                    cy.log(`Typed "${valueToType}" into element: ${objectLocator}`);
                    // Intercept the request after the action has been performed
                    cy.intercept('GET', '**/b/ss/**v5**').as('specificRequest');

                    // Wait for the intercepted request after the action
                    return cy.wait('@specificRequest', { timeout: 10000 }).then((interception) => {
                      processInterceptedRequest(interception, row, aemData, aemDataFilePath, outputFilePath);
                    });
                  });
              }
            }
          });
        } else {
          // Log a warning if the URL is empty
          cy.log(`Warning: Empty URL found in row: ${JSON.stringify(row)}`);
        }
      });
    });
  });
});

// Helper function to process intercepted request
function processInterceptedRequest(interception, row, aemData, aemDataFilePath, outputFilePath) {
  const interceptedUrl = interception.request.url;
  const queryString = interceptedUrl.split('?')[1] || '';
  const decodedQuery = decodeURIComponent(queryString);
  const keyValuePairs = decodedQuery.split('&');

  const extractedData = {};
  keyValuePairs.forEach(pair => {
    const [key, value] = pair.split('=');
    extractedData[key] = value || '';
  });

  // Log and write extracted data to output CSV
  cy.task('writeToCSV', createCSVRow(extractedData), { filePath: outputFilePath });

  // Prepare final data for verification
  const finalData = prepareFinalData(extractedData, row);

  // Compare values with AEM data
  const fieldName = row.Fieldname; // Assuming the field name is in the 'Fieldname' column
  const expectedValue = row.Value; // Assuming the expected value is in the 'Value' column
  row.Status = (finalData[fieldName]?.trim().toLowerCase() === expectedValue.trim().toLowerCase()) ? 'Pass' : 'Fail';

  // Write updated AEM data back to the CSV file
  cy.writeFile(aemDataFilePath, Papa.unparse(aemData));
}

// Helper functions
function createCSVRow(data) {
  const outputHeader = Object.keys(data).join(',') + '\n';
  const outputRow = Object.values(data).join(',') + '\n';
  return outputHeader + outputRow;
}

function prepareFinalData(extractedData, row) {
  const headerKeys = [
    'ce', 'cc', 'g', 'v', 'mid', 'pageName', 'rs', 'server', 't', 'ns',
    'c3', 'c4', 'c10', 'c19', 'c24', 'c30', 'c31', 'c38', 'c46', 'c48',
    'c49', 'c56', 'c57', 'c58', 'c75', 'v22', 'v5', 'v27', 'v41', 'v45',
    'v60', 'v61', 'v74', 'v75', 'v94', 'v122', 'v140', 'h1', 'ssf', 'lob',
    'visitorCheck', 'bh', 't', 'bw', 'cl', 'c', 'j', 'mcorgid', 'pf',
    's', 'prop22'
  ];

  const finalData = {};
  headerKeys.forEach(key => {
    finalData[key] = extractedData[key] || '';
  });

  return finalData;
}
