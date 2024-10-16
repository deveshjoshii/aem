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
                    // cy.intercept('GET', '**/b/ss/**').as('specificRequestAfterClick');
                    cy.intercept('GET', '**/b/ss/**', (req) => {
                      // Check if the request query parameters contain 'v5'
                      if (req.url.includes('v5')) {
                          req.alias = 'specificRequestAfterClick';
                      }
                    });



                    // Assert that the menu item is visible before clicking
                    cy.get(objectLocator)
                      .should('be.visible')
                      .click()
                      .then(() => {
                        // cy.url().should('include', '/hil-lto-q3/page/30#applyForCard'); // Adjust based on your expected URL

                        // Wait for the intercepted request after the action
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
                    // Wait for the intercepted request after typing
                    cy.wait('@specificRequestAfterType', { timeout: 10000 }).then((interception) => {
                      processInterceptedRequest(interception, row, requestData);
                    });
                  });
              }
            }
          });
        } else {
          cy.log(`Warning: Empty URL found in row: ${JSON.stringify(row)}`);
        }
      }).then(() => {
        // Final assertions after all requests are captured
        assertCapturedData(aemData, requestData, aemDataFilePath);
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

  return extractedData; // Return extracted data for further processing if needed
}

// Function to assert captured data and write results back to CSV
function assertCapturedData(aemData, requestData, filePath) {
   // Iterate over each row in aemData to check the status of captured requests
   aemData.forEach(row => {
    const fieldName = row.Fieldname; // Field name from CSV
    const expectedValue = row.Value; // Expected value from CSV
    const assertURL = row.AssertURL === 'true'; // Check if URL assertion is required

    // Default to "Fail"
    let status = 'Fail';
    let actualValue = ''; // Initialize to store the actual value

    // Iterate through the captured requests in the requestData
    Object.values(requestData).forEach(req => {
      // Check if the fieldName from the CSV exists in the captured request's params
      if (req.params[fieldName]) {
        actualValue = req.params[fieldName]?.trim().toLowerCase() || ''; // Trim and get the actual value
        const expectedValueTrimmed = expectedValue.trim().toLowerCase(); // Trim the expected value from CSV

        // Log the actual and expected values for visibility
        cy.log(`Field: ${fieldName}, Expected: "${expectedValueTrimmed}", Actual: "${actualValue}"`);

        // Compare the actual and expected values
        if (actualValue === expectedValueTrimmed) {
          status = 'Pass'; // Mark as Pass if the values match
        }
      }
    });

    // Log a warning if the fieldName from the CSV is not found in any request params
    if (!actualValue) {
      cy.log(`Warning: Field "${fieldName}" not found in any captured requests.`);
    }

    // Set the status in the row based on the comparison result
    row.Status = status;
    cy.log(`Field: ${fieldName}, Status: ${status}`);
  });

  // Write updated data back to CSV
  writeBackToCSV(filePath, aemData);
}

// Function to write updated data back to CSV
function writeBackToCSV(filePath, data) {
  const csv = Papa.unparse(data); // Convert data back to CSV format
  cy.writeFile(filePath, csv); // Write to the original CSV file
}
