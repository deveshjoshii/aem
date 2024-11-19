const fs = require('fs');
const Papa = require('papaparse');

describe('Intercept request, perform actions, and process values', () => {
  let requestData = {}; // Dictionary to store all request data
  let googleSheetData = []; // Array to store data fetched from Google Sheets

  before(() => {
    // Fetch data from Google Sheets before running tests
    cy.task('readGoogleSheet', { range: 'Sheet1!A:F' }).then((rows) => {
      googleSheetData = rows; // Store the data from Google Sheets
      cy.log('Fetched data from Google Sheets:', googleSheetData);
    });
  });

  beforeEach(() => {
    // Catch uncaught exceptions to prevent test failure
    Cypress.on('uncaught:exception', (err) => {
      if (err.message.includes('digitalData.event is undefined')) {
        cy.log('Caught uncaught exception: ' + err.message);
        return false; // Prevents Cypress from failing the test
      }
    });
  });

  it('Processes data from Google Sheets, performs actions, and checks values', () => {
    if (googleSheetData.length === 0) {
      cy.log('No valid data to process.');
      return;
    }

    // Process each row asynchronously
    cy.wrap(googleSheetData.slice(1)).each((row, index) => {
      const urlToVisit = row[1]; // URL is assumed to be in the second column
      const action = row[4]; // Assuming 'Action' is in the fifth column

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
          const valueToType = row[3]; // Assuming 'Value' is in the fourth column

          if (actionType === 'click') {
            cy.get(objectLocator)
              .should('be.visible')
              .click()
              .then(() => {
                cy.log(`Clicked on element: ${objectLocator}`);
                cy.wait(1000);

                // Intercept the request after the action
                cy.wait('@specificRequest', { timeout: 10000 }).then((interception) => {
                  processInterceptedRequest(interception, row, requestData);
                });
              });
          } else if (actionType === 'type') {
            cy.get(objectLocator)
              .should('be.visible')
              .type(valueToType)
              .then(() => {
                cy.log(`Typed "${valueToType}" into element: ${objectLocator}`);
                cy.wait(1000);

                // Intercept the request after the action
                cy.wait('@specificRequest', { timeout: 10000 }).then((interception) => {
                  processInterceptedRequest(interception, row, requestData);
                });
              });
          }
        }
      });
    }).then(() => {
      assertCapturedData(googleSheetData, requestData);
      cy.task('updateDatabase', requestData).then((result) => {
        cy.log('Database updated successfully: ', result);
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

// Function to assert captured data
function assertCapturedData(googleSheetData, requestData) {
  googleSheetData.forEach((row) => {
    const fieldName = row[2]; // Assuming 'Fieldname' is in the third column
    const expectedValue = row[3]; // Assuming 'Value' is in the fourth column
    let status = 'Fail';
    let actualValue = '';

    Object.values(requestData).forEach((req) => {
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

    row[5] = status; // Assuming 'Status' is in the sixth column
    cy.log(`Field: ${fieldName}, Status: ${status}`);
  });
}
