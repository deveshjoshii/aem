const fs = require('fs');
const Papa = require('papaparse');

describe('Intercept requests, perform actions, and validate data', () => {
  let requestData = {}; // Dictionary to store intercepted request data
  let googleSheetData = []; // Array to store data fetched from Google Sheets

  before(() => {
    // Fetch data from Google Sheets before running the tests
    cy.task('readGoogleSheet', { range: 'Sheet2!A:F' }).then((rows) => {
      googleSheetData = rows || [];
      cy.log('Fetched data from Google Sheets:', googleSheetData);
    });
  });

  beforeEach(() => {
    // Handle uncaught exceptions
    Cypress.on('uncaught:exception', (err) => {
      if (err.message.includes('digitalData.event is undefined')) {
        cy.log('Caught uncaught exception: ' + err.message);
        return false; // Prevent test failure
      }
    });
  });

  it('Processes data from Google Sheets and validates requests', () => {
    if (googleSheetData.length === 0) {
      cy.log('No data to process.');
      return;
    }

    // Process each row in the Google Sheet
    cy.wrap(googleSheetData.slice(1)).each((row, rowIndex) => {
      const urlToVisit = row[1]; // URL (Column B)
      const fieldName = row[2]; // Field name (Column C)
      const expectedValue = row[3]; // Expected value (Column D)
      const action = row[4]; // Action (Column E)

      // Intercept requests
      cy.intercept('GET', '**/b/ss/**').as('specificRequest');

      // Visit the specified URL
      cy.visit(urlToVisit).then(() => {
        // Wait for the first request
        cy.wait('@specificRequest', { timeout: 10000 }).then((interception) => {
          if (interception) {
            processInterceptedRequest(interception, row, requestData);
          }
        });

        // Perform actions if specified
        if (action) {
          const [actionType, locator] = action.split('|');
          const valueToType = expectedValue;

          if (actionType === 'click') {
            cy.get(locator).should('be.visible').click().then(() => {
              cy.log(`Clicked on element: ${locator}`);
              cy.wait(1000);
              cy.wait('@specificRequest', { timeout: 10000 }).then((interception) => {
                if (interception) {
                  processInterceptedRequest(interception, row, requestData);
                }
              });
            });
          } else if (actionType === 'type') {
            cy.get(locator).should('be.visible').type(valueToType).then(() => {
              cy.log(`Typed "${valueToType}" into element: ${locator}`);
              cy.wait(1000);
              cy.wait('@specificRequest', { timeout: 10000 }).then((interception) => {
                if (interception) {
                  processInterceptedRequest(interception, row, requestData);
                }
              });
            });
          }
        }
      });
    }).then(() => {
      // Validate captured data and update Google Sheets
      validateAndUpdateGoogleSheet(googleSheetData, requestData);
    });
  });
});

// Helper function to process intercepted requests
function processInterceptedRequest(interception, row, requestData) {
  const url = interception.request.url;
  const params = new URLSearchParams(url.split('?')[1]);
  const extractedData = Object.fromEntries(params.entries());

  const requestId = `request_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  requestData[requestId] = {
    url,
    params: extractedData,
    timestamp: interception.timestamp,
  };

  cy.log('Intercepted request data:', extractedData);
}

// Function to validate captured data and update Google Sheets
function validateAndUpdateGoogleSheet(googleSheetData, requestData) {
  googleSheetData.slice(1).forEach((row, rowIndex) => {
    const actualRowIndex = rowIndex + 2; // Account for skipping the header row (starts from the second row)
    const fieldName = row[2]; // Field name (Column C)
    const expectedValue = row[3]; // Expected value (Column D)
    let status = 'Fail';

    // Check intercepted request data
    Object.values(requestData).forEach((req) => {
      const actualValue = req.params[fieldName]?.trim().toLowerCase() || '';
      if (actualValue === expectedValue.trim().toLowerCase()) {
        status = 'Pass';
      }
    });

    // Update status in Google Sheets
    const sheetRange = `Sheet2!F${actualRowIndex}`; // Update range for the status column
    cy.task('writeGoogleSheet', { range: sheetRange, values: [[status]] }).then((result) => {
      cy.log(`Updated row ${actualRowIndex} with status: ${status}`);
    });
  });

  // Optional: Log captured data to a database
  cy.task('updateDatabase', requestData).then((result) => {
    cy.log('Database updated with captured request data:', result);
  });
}
