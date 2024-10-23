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

      // Filter rows with a non-empty URL field
      const filteredData = aemData.filter((row) => row.Url && row.Url.trim() !== '');

      if (filteredData.length === 0) {
        cy.log('No valid URLs found in the CSV file. Test aborted.');
        return; // Stop the test if no valid rows are found
      }

      // Process each filtered row asynchronously
      cy.wrap(filteredData).each((row, index) => {
        const urlToVisit = row.Url; // Assuming the URL is in the 'Url' column
        const action = row.Action; // Assuming the action is in the 'Action' column

        // Intercept requests to store later
        cy.intercept('GET', '**/b/ss/**').as('specificRequest');

        // Visit the page
        cy.visit(urlToVisit).then(() => {
          // Wait for the intercepted request
          cy.wait('@specificRequest', { timeout: 10000 }).then((interception) => {
            processInterceptedRequest(interception, row, requestData);
          });

          if (action && action.includes('|')) {
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
                  cy.intercept('GET', '**/b/ss/**', (req) => {
                    if (req.url.includes('v5')) {
                      req.alias = 'specificRequestAfterClick';
                    }
                  });

                  cy.get(objectLocator)
                    .should('be.visible')
                    .click()
                    .then(() => {
                      cy.wait('@specificRequestAfterClick', { timeout: 10000 }).then((interception) => {
                        processInterceptedRequest(interception, row, requestData);
                      });
                    });
                });
            } else if (actionType === 'type') {
              cy.get(objectLocator)
                .should('be.visible')
                .type(valueToType)
                .then(() => {
                  cy.log(`Typed "${valueToType}" into element: ${objectLocator}`);
                  cy.intercept('GET', '**/b/ss/**').as('specificRequestAfterType');
                  cy.wait(1000);
                  cy.wait('@specificRequestAfterType', { timeout: 10000 }).then((interception) => {
                    processInterceptedRequest(interception, row, requestData);
                  });
                });
            }
          }
        });
      }).then(() => {
        assertCapturedData(filteredData, requestData, aemDataFilePath);
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

  return extractedData;
}

// Function to assert captured data and write results back to CSV
function assertCapturedData(filteredData, requestData, filePath) {
  filteredData.forEach(row => {
    const fieldName = row.Fieldname;
    const expectedValue = row.Value;
    const assertURL = row.AssertURL === 'true';

    let status = 'Fail';
    let actualValue = '';

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

    row.Status = status;
    cy.log(`Field: ${fieldName}, Status: ${status}`);
  });

  writeBackToCSV(filePath, filteredData);
}

function writeBackToCSV(filePath, data) {
  const csv = Papa.unparse(data);
  cy.writeFile(filePath, csv);
}
