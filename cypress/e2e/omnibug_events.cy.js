describe('Read Console Data', () => {
  it('opens a page and captures console data for 5 seconds', () => {
    const consoleLogs = [];

    // Visit the target URL
    cy.visit('https://www.americanexpress.com/en-in/', {
      onBeforeLoad(win) {
        cy.stub(win.console, 'log').callsFake((msg) => {
          consoleLogs.push(msg);
          // Immediately log to Cypress console
          cy.log(`Console log: ${msg}`);
        });
      },
    });

    // Wait for 5 seconds
    cy.wait(5000);

    // Print collected logs to Cypress command log
    cy.then(() => {
      cy.log('All collected console logs:');
      consoleLogs.forEach(log => {
        cy.log(log);
      });
    });

    // Force Cypress to log the test as complete
    cy.log('Test complete');
  });
});
