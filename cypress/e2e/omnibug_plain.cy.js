// cypress/e2e/omnibug_plain.cy.js
describe('Capture Marketing and Analytics Tags', () => {
  it('intercepts and validates requests against Excel data', () => {
      const tagLogs = [];
      const testData = [];

      // Use the Cypress task to read the Excel file
      cy.task('readExcelFile', { filePath: 'cypress/fixtures/aemData.xlsx' }).then((jsonData) => {
          // Store test data
          jsonData.forEach(row => {
              testData.push({
                  url: row.URL,
                  eventFieldName: row.EventFieldName,
                  expectedValue: row.Value,
                  status: 'Pending' // Initial status
              });
          });

          // Iterate through each URL
          testData.forEach(test => {
              // Intercept requests
              cy.intercept('**', (req) => {
                  const url = req.url;
                  if (url.includes('amexpressenterprise')) { // Filter for specific requests
                      tagLogs.push(`Request: ${url}`);

                      // Parse the URL to extract parameters
                      const urlParams = new URL(url);
                      const queryParams = Object.fromEntries(urlParams.searchParams.entries());

                      // Check if the request contains the EventFieldName
                      if (queryParams[test.eventFieldName]) {
                          const actualValue = queryParams[test.eventFieldName];
                          // Log the actual value for debugging
                          cy.log(`Actual Value: ${actualValue}, Expected Value: ${test.expectedValue}`);

                          // Assert the value
                          if (actualValue === test.expectedValue) {
                              test.status = 'Pass'; // Update status to Pass
                          } else {
                              test.status = 'Fail'; // Update status to Fail
                          }
                      } else {
                          cy.log(`EventFieldName ${test.eventFieldName} not found in query parameters.`);
                      }
                  }
              }).as('allRequests');

              // Visit the target URL
              cy.visit(test.url);
              cy.wait('@allRequests'); // Wait for the specific request to complete
          });

          // Log all captured data
          cy.then(() => {
              cy.log('All captured marketing and analytics tags:');
              tagLogs.forEach(log => {
                  cy.log(log);
              });

              // Output the test results
              testData.forEach(test => {
                  cy.log(`URL: ${test.url}, EventFieldName: ${test.eventFieldName}, Expected Value: ${test.expectedValue}, Status: ${test.status}`);
              });

              // Prepare data for updating the Excel file
              const updatedData = testData.map(test => ({
                  URL: test.url,
                  EventFieldName: test.eventFieldName,
                  Value: test.expectedValue,
                  Status: test.status // Update status
              }));

              // Write updated data back to the Excel file
              cy.task('writeExcelFile', { filePath: 'cypress/fixtures/aemData.xlsx', data: updatedData });
          });
      });
  });
});