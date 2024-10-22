const fs = require('fs');
const Papa = require('papaparse');

describe('Intercept request, perform actions, and process values', () => {
  let requestData = {}; // Dictionary to store all intercepted request data

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
    const aemDataFilePath = 'cypress/fixtures/urls.csv'; // AEM data CSV file path

    // Read AEM data to get the URLs
    cy.readFile(aemDataFilePath).then((fileContent) => {
      const aemData = Papa.parse(fileContent, { header: true }).data;

      // Filter out rows with empty or null URLs
      const validRows = aemData.filter(row => row.Url && row.Url.trim() !== '');

      if (validRows.length === 0) {
        cy.log('No valid URLs to process.');
        return;
      }

      // Process each row asynchronously
      cy.wrap(validRows).each((row, index) => {
        const urlToVisit = row.Url; // Assuming the URL is in the 'Url' column
        const action = row.Action; // Assuming the action is in the 'Action' column

        // Visit the page
        cy.visit(urlToVisit).then(() => {
          // Check if there's an action to perform
          if (action && action.includes('|')) {
            const [actionType, objectLocator] = action.split('|');
            const valueToType = row.Value; // Assuming there's a 'Value' column for typing

            if (actionType === 'click') {
              cy.get(objectLocator).should('exist')
                .click({ force: true })
                .then(() => {
                  cy.log(`Clicked on element: ${objectLocator}`);
                  cy.wait(1000); // Wait for any actions post-click

                  // Intercept the latest request after the action is performed
                  cy.intercept('POST', '**https://analytics.google.com/g/collect**').as('specificRequestAfterClick');
                  cy.wait('@specificRequestAfterClick', { timeout: 10000 }).then((interception) => {
                    storeRequestData(interception, row, requestData);
                  });
                });
            } else if (actionType === 'type') {
              cy.get(objectLocator)
                .should('be.visible')
                .type(valueToType)
                .then(() => {
                  cy.log(`Typed "${valueToType}" into element: ${objectLocator}`);
                  cy.wait(1000);

                  // Intercept the latest request after the action is performed
                  cy.intercept('POST', '**https://analytics.google.com/g/collect**').as('specificRequestAfterType');
                  cy.wait('@specificRequestAfterType', { timeout: 10000 }).then((interception) => {
                    storeRequestData(interception, row, requestData);
                  });
                });
            }
          } else {
            // If there's no action, intercept the request normally
            cy.intercept('POST', '**https://analytics.google.com/g/collect**').as('specificRequest');
            cy.wait('@specificRequest', { timeout: 10000 }).then((interception) => {
              storeRequestData(interception, row, requestData);
            });
          }
        });
      }).then(() => {
        // Final assertions after all requests are captured
        compareWithCSVData(validRows, requestData, aemDataFilePath);
      });
    });
  });
});

// Helper function to store intercepted request data
function storeRequestData(interception, row, requestData) {
  const interceptedUrl = interception.request.url;
  const queryString = interceptedUrl.split('?')[1] || '';
  const decodedQuery = decodeURIComponent(queryString);
  const keyValuePairs = decodedQuery.split('&');

  const extractedData = {};
  keyValuePairs.forEach((pair) => {
    const [key, value] = pair.split('=');
    extractedData[key] = value || '';
  });

  cy.log('Extracted Parameters: ' + JSON.stringify(extractedData));

  const requestId = `request_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  requestData[requestId] = {
    url: interceptedUrl,
    status: interception.response.statusCode,
    headers: interception.response.headers,
    request_id: requestId,
    timestamp: interception.timestamp,
    params: extractedData,
  };
  console.log('Current requestData:', requestData);
  return extractedData;
}

// Function to compare CSV data with intercepted request data
function compareWithCSVData(aemData, requestData, filePath) {
  aemData.forEach(row => {
    const fieldName = row.Fieldname; // Column for field name
    const expectedValue = row.Value; // Expected value to compare
    const assertURL = row.AssertURL === 'true';

    let status = 'Fail'; // Default status
    let actualValue = '';

    // Iterate through intercepted request data
    Object.values(requestData).forEach(req => {
      if (req.params[fieldName]) {
        actualValue = req.params[fieldName]?.trim().toLowerCase() || '';
        const expectedValueTrimmed = expectedValue.trim().toLowerCase();

        cy.log(`Field: ${fieldName}, Expected: "${expectedValueTrimmed}", Actual: "${actualValue}"`);

        if (actualValue === expectedValueTrimmed) {
          status = 'Pass';
        }
      }
    });

    if (!actualValue) {
      cy.log(`Warning: Field "${fieldName}" not found in any captured requests.`);
    }

    // Update the row with status
    row.Status = status;
    cy.log(`Field: ${fieldName}, Status: ${status}`);
  });

  // Write the updated status back to the CSV
  writeBackToCSV(filePath, aemData);
}

// Function to write updated data back to CSV
function writeBackToCSV(filePath, data) {
  const csv = Papa.unparse(data);
  cy.writeFile(filePath, csv);
}
