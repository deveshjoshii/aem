describe('Intercept request, perform actions, and process values', () => { 
  let googleSheetData = []; // Declare googleSheetData at the top level
  let requestData = {}; // To store all intercepted request data

  before(() => {
    // Fetch data from Google Sheets
    cy.task('readGoogleSheet', { range: 'Sheet2!A:F' }).then((rows) => {
      // Filter rows that contain data
      googleSheetData = rows.filter((row, index) => {
        const hasData = row.some((cell) => cell && cell.trim());
        if (!hasData) {
          cy.log(`Skipping row ${index + 1}: No data present.`);
          return false; // Exclude rows without any data
        }
        return true; // Include rows with at least one non-empty cell
      });

      cy.log('Filtered Google Sheet Data:', JSON.stringify(googleSheetData));
    });
  });

  beforeEach(() => {
    // Catch uncaught exceptions to prevent test failure
    Cypress.on('uncaught:exception', (err) => {
      if (err.message.includes('digitalData.event is undefined')) {
        cy.log('Caught uncaught exception: ' + err.message);
        return false; // Prevent test failure on this exception
      }
      return true; // Let other exceptions fail the test
    });

    // Set up global intercept for requests
    cy.intercept({
      method: 'GET',
      url: '**/b/ss/**',
    }).as('getAnalyticsRequests');
    
    // cy.intercept({
    //   method: 'POST',
    //   url: '**/b/ss/**',
    // }).as('postAnalyticsRequests');
  });

  function performActions(actions) {
    const actionPairs = actions.split('|');
    let i = 0;
    while (i < actionPairs.length) {
      const actionType = actionPairs[i];
      const objectLocator = actionPairs[i + 1];
      const value = actionPairs[i + 2];

      if (actionType === 'click') {
        cy.get(objectLocator).should('exist').click({ force: true });
        cy.wait(1000);
        i += 2; // Move to the next action
      } else if (actionType === 'type') {
        cy.get(objectLocator).should('be.visible').type(value);
        cy.wait(1000);
        i += 3; // Move to the next action
      } else if (actionType === 'select' || actionType === 'dropdown') {
        cy.get(objectLocator).should('exist').select(value); // Dropdown selection
        cy.wait(1000);
        i += 3; // Move to the next action
      } else {
        cy.log(`Unsupported action type: ${actionType}`);
        cy.wait(1000);
        i += 1; // Move to the next action (skip unknown action)
      }
    }
  }

  it('Processes data from Google Sheets, performs actions, and checks values', () => {
    if (!googleSheetData || googleSheetData.length === 0) {
      cy.log('No valid data to process.');
      return;
    }

    const rowProcessingPromises = [];

    cy.wrap(googleSheetData.slice(1)).each((row, index) => {
      const urlToVisit = row[1]?.trim(); // URL column
      const actions = row[4]; // Actions column
      const actionCount = actions ? actions.split('|').length / 3 : 0; // Count actions

      cy.log(`Processing row ${index + 1}: URL = ${urlToVisit || 'No URL'}, Actions = ${actions || 'No Actions'}`);

      const rowPromise = new Cypress.Promise((resolve) => {
        let capturedRequests = 0;

        if (urlToVisit) {
          cy.visit(urlToVisit);
        }

        if (actions) {
          performActions(actions);
        }

        if (actionCount > 0) {
          const waitForRequests = () => {
            cy.wait('@getAnalyticsRequests', { timeout: 70000 }).then((interception) => {
              storeRequestData(interception, row, requestData);
              capturedRequests++;

              // cy.wait('@postAnalyticsRequests', { timeout: 70000 }).then((interception) => {
              //   storeRequestData(interception, row, requestData);
              //   capturedRequests++;

                if (capturedRequests < actionCount) {
                  waitForRequests();
                } else {
                  resolve();
                }
              });
            // });
          };

          waitForRequests();
        } else {
          resolve();
        }
      });

      rowProcessingPromises.push(rowPromise);
    }).then(() => {
      Cypress.Promise.all(rowProcessingPromises).then(() => {
        cy.log('All rows processed and all requests captured. Proceeding to comparison.');

        compareWithGoogleSheetData(googleSheetData, requestData);

        cy.task('updateSheetAndDatabase').then((result) => {
          cy.log('Update result:', result);
        });
      });
    });
  });
});

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
