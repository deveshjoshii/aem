describe('Intercept request, visit URLs, and process values', () => {
  let googleSheetData = []; // Holds Google Sheets data
  let requestData = {}; // To store all intercepted request data

  before(() => {
    // Fetch data from Google Sheets
    cy.task('readGoogleSheet', { range: 'Sheet2!A:F' }).then((rows) => {
      // Filter rows that contain data
      googleSheetData = rows.filter((row, index) => {
        const hasData = row.some((cell) => cell && cell.trim());
        if (!hasData) {
          cy.log(`Skipping row ${index + 1}: No data present.`);
          return false;
        }
        return true;
      });

      cy.log('Filtered Google Sheet Data:', JSON.stringify(googleSheetData));
    });
  });

  beforeEach(() => {
    // Catch uncaught exceptions
    Cypress.on('uncaught:exception', (err) => {
      if (err.message.includes('digitalData.event is undefined')) {
        cy.log('Caught uncaught exception: ' + err.message);
        return false;
      }
      return true;
    });

    // Intercept network requests
    cy.intercept({
      method: 'GET',
      url: '**/b/ss/**',
    }).as('analyticsRequests');
  });

  it('Processes data from Google Sheets, visits URLs, captures requests, and performs actions', () => {
    if (!googleSheetData || googleSheetData.length === 0) {
      cy.log('No valid data to process.');
      return;
    }

    // Process each row of Google Sheets data
    const rowProcessingPromises = googleSheetData.slice(1).map((row, index) => {
      return new Cypress.Promise((resolve) => {
        const urlToVisit = row[1]?.trim(); // URL column
        const actions = row[4]; // Actions column
        const actionCount = actions ? actions.split('|').length / 3 : 0;

        cy.log(`Processing row ${index + 1}: URL = ${urlToVisit || 'No URL'}, Actions = ${actions || 'No Actions'}`);

        let capturedRequests = 0; // Track the number of captured requests
        const requestPromises = []; // Track all request promises

        if (urlToVisit) {
          // Visit the URL and capture requests
          cy.visit(urlToVisit).then(() => {
            const waitForRequests = () => {
              cy.wait('@analyticsRequests', { timeout: 30000 }).then((interception) => {
                storeRequestData(interception, row, requestData);
                capturedRequests++;

                // Add a resolved promise for the current request
                requestPromises.push(Promise.resolve());

                if (capturedRequests < actionCount) {
                  waitForRequests(); // Continue waiting for remaining requests
                } else {
                  // Resolve once all requests are captured
                  Promise.all(requestPromises).then(() => resolve());
                }
              });
            };

            // Start capturing requests
            waitForRequests();
          });
        }

        if (actions) {
          // Perform actions defined in the sheet
          performActions(actions);
        }
      });
    });

    // Wait for all rows to be processed
    Cypress.Promise.all(rowProcessingPromises).then(() => {
      cy.log('All rows processed and all requests captured.');

      // Compare captured data with Google Sheets data
      compareWithGoogleSheetData(googleSheetData, requestData);

      // Update Google Sheet and database
      cy.task('updateSheetAndDatabase').then((result) => {
        cy.log('Update result:', result);
      });
    });
  });
});

// Perform actions like click, type, or select
function performActions(actions) {
  const actionPairs = actions.split('|');
  let i = 0;
  while (i < actionPairs.length) {
    const actionType = actionPairs[i];
    const objectLocator = actionPairs[i + 1];
    const value = actionPairs[i + 2];

    if (actionType === 'click') {
      cy.get(objectLocator).should('exist').click({ force: true });
      cy.wait(500);
      i += 2;
    } else if (actionType === 'type') {
      cy.get(objectLocator).should('be.visible').type(value);
      cy.wait(500);
      i += 3;
    } else if (actionType === 'select' || actionType === 'dropdown') {
      cy.get(objectLocator).should('exist').select(value);
      cy.wait(500);
      i += 3;
    } else {
      cy.log(`Unsupported action type: ${actionType}`);
      i += 1;
    }
  }
}

// Store captured request data
function storeRequestData(interception, row, requestData) {
  const interceptedUrl = interception.request.url;
  const queryString = interceptedUrl.split('?')[1] || '';
  const decodedQuery = decodeURIComponent(queryString);

  const fieldName = row[2]?.trim(); // Field Name column
  const requiredParams = ['en', 'ep.action_type', 'ep.first_field_name', 'ep.first_field_id', fieldName];

  const containsRequiredParam = requiredParams.some((param) => decodedQuery.includes(param));
  if (!containsRequiredParam) {
    cy.log(`Skipping request: Missing required parameters, including "${fieldName}".`);
    return;
  }

  const keyValuePairs = decodedQuery.split('&');
  const extractedData = {};

  keyValuePairs.forEach((pair) => {
    const [key, value] = pair.split('=');
    extractedData[key] = value || '';
  });

  const requestId = `request_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  requestData[requestId] = { params: extractedData };

  cy.log('Captured Request Data:', JSON.stringify(requestData));
}

// Compare Google Sheets data with captured requests
function compareWithGoogleSheetData(sheetData, requestData) {
  sheetData.forEach((row, rowIndex) => {
    if (rowIndex === 0) return;

    const fieldName = row[2];
    const expectedValue = row[3];
    let status = 'Fail';

    Object.values(requestData).forEach((req) => {
      const actualValue = req.params[fieldName]?.trim().toLowerCase();
      if (actualValue === expectedValue.trim().toLowerCase()) {
        status = 'Pass';
      }
    });

    cy.log(`Row ${rowIndex + 1}: Field "${fieldName}", Status: ${status}`);
    const sheetRange = `Sheet2!F${rowIndex + 1}`;

    cy.task('writeGoogleSheet', { range: sheetRange, values: [[status]] });
  });
}
