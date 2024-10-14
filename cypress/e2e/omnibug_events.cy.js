const fs = require('fs');
const Papa = require('papaparse');

describe('Intercept request, perform actions, and process values', () => {
  let requestData = {}; // Dictionary to store all request data

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

    // Read AEM data to get the URLs
    cy.readFile(aemDataFilePath).then((fileContent) => {
      const aemData = Papa.parse(fileContent, { header: true }).data;

      // Process each row asynchronously
      cy.wrap(aemData).each((row, index) => {
        const urlToVisit = row.Url; // Assuming the URL is in the 'Url' column
        const action = row.Action; // Assuming the action is in the 'Action' column

        // Check if the URL is not empty before visiting
        if (urlToVisit) {
          // Visit the page
          cy.visit(urlToVisit).then(() => {
            if (!action) {
              cy.log(`No action provided. Fetching request for URL: ${urlToVisit}`);

              // Intercept the request after the URL visit
              cy.intercept('GET', '**/b/ss/**').as('specificRequest'); // Adjust the intercept pattern as needed

              // Wait for the intercepted request after visiting the URL
              return cy.wait('@specificRequest', { timeout: 10000 }).then((interception) => {
                const status = processInterceptedRequest(interception, row, requestData);
                row.Status = status; // Add the status to the row
                writeBackToCSV(aemDataFilePath, aemData); // Write updated data to CSV
              });
            } else if (action && action.includes('|')) {
              const [actionType, objectLocator] = action.split('|');
              const valueToType = row.Value; // Assuming there's a 'Value' column for typing

              if (actionType === 'click') {
                cy.get(objectLocator)
                  .should('be.visible')
                  .click()
                  .then(() => {
                    cy.log(`Clicked on element: ${objectLocator}`);
                    cy.wait(1000); // Wait for any actions post-click

                    // Intercept the request after the action
                    cy.intercept({
                      method: 'GET',
                      url: '**/b/ss/**',
                      query: { v5: '**' },
                    }).as('specificRequest');

                    // Wait for the intercepted request after the action
                    return cy.wait('@specificRequest', { timeout: 10000 }).then((interception) => {
                      const status = processInterceptedRequest(interception, row, requestData);
                      row.Status = status; // Add the status to the row
                      writeBackToCSV(aemDataFilePath, aemData); // Write updated data to CSV
                    });
                  });
              } else if (actionType === 'type') {
                cy.get(objectLocator)
                  .should('be.visible')
                  .type(valueToType)
                  .then(() => {
                    cy.log(`Typed "${valueToType}" into element: ${objectLocator}`);
                    cy.intercept('GET', '**/b/ss/**v5**').as('specificRequest');

                    return cy.wait('@specificRequest', { timeout: 10000 }).then((interception) => {
                      const status = processInterceptedRequest(interception, row, requestData);
                      row.Status = status; // Add the status to the row
                      writeBackToCSV(aemDataFilePath, aemData); // Write updated data to CSV
                    });
                  });
              }
            }
          });
        } else {
          cy.log(`Warning: Empty URL found in row: ${JSON.stringify(row)}`);
        }
      });
    });
  });
});

// Helper function to process intercepted request
function processInterceptedRequest(interception, row, requestData) {
  const interceptedUrl = interception.request.url;
  const queryString = interceptedUrl.split('?')[1] || '';
  const decodedQuery = decodeURIComponent(queryString);
  const keyValuePairs = decodedQuery.split('&');

  const extractedData = {};
  keyValuePairs.forEach((pair) => {
    const [key, value] = pair.split('=');
    extractedData[key] = value || '';
  });

  // Log extracted data for debugging
  cy.log('Extracted Parameters: ' + JSON.stringify(extractedData));

  // Generate a unique request ID
  const requestId = `request_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // Store data in requestData dictionary
  requestData[requestId] = {
    url: interceptedUrl,
    status: interception.response.statusCode,
    headers: interception.response.headers,
    request_id: requestId,
    timestamp: interception.timestamp,
    params: extractedData,
  };

  // Prepare final data for verification
  const finalData = prepareFinalData(extractedData);

  // Compare values with AEM data
  const fieldName = row.Fieldname; // Assuming the field name is in the 'Fieldname' column
  const expectedValue = row.Value; // Assuming the expected value is in the 'Value' column

  // Trim and lowercase both values for accurate comparison
  const actualValue = finalData[fieldName]?.trim().toLowerCase() || '';
  const expectedValueTrimmed = expectedValue.trim().toLowerCase();

  // Set the status based on comparison
  const status = (actualValue === expectedValueTrimmed) ? 'Pass' : 'Fail';
  // Instead of modifying the row, store results in requestData
  requestData[requestId].status = status;

  // Log the status for debugging
  cy.log(`Status for URL: ${row.Url} - Expected: "${expectedValueTrimmed}", Actual: "${actualValue}", Status: ${status}`);

  // Log requestData after comparison
  cy.log('Request Data after comparison: ' + JSON.stringify(requestData));

  return status; // Return status for the CSV
}

// Helper function to map extracted data
function prepareFinalData(extractedData) {
  const headerKeys = [
    'ce', 'cc', 'g', 'v', 'mid', 'pageName', 'rs', 'server', 't', 'ns',
    'c3', 'c4', 'c10', 'c19', 'c24', 'c30', 'c31', 'c38', 'c46', 'c48',
    'c49', 'c56', 'c57', 'c58', 'c75', 'v22', 'v5', 'v27', 'v41', 'v45',
    'v60', 'v61', 'v74', 'v75', 'v94', 'v122', 'v140', 'h1', 'ssf', 'lob',
    'visitorCheck', 'bh', 't', 'bw', 'cl', 'c', 'j', 'mcorgid', 'pf',
    's', 'prop22'
  ];

  const finalData = {};
  headerKeys.forEach((key) => {
    finalData[key] = extractedData[key] || '';
  });

  return finalData;
}

// Function to write updated data back to CSV
function writeBackToCSV(filePath, data) {
  const csv = Papa.unparse(data); // Convert data back to CSV format
  cy.writeFile(filePath, csv); // Write to the original CSV file
}
