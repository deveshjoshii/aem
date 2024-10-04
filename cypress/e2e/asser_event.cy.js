// cypress/integration/adobeEvent.spec.js
describe('Adobe Analytics Event Test', () => {
    it('should validate if the given Adobe event is triggered', () => {
      cy.visit('https://www.americanexpress.com/en-in/');  // Replace with your website
  
      // Validate if the Adobe event 'pageLoad' was triggered
      cy.validateAdobeEvent('pageLoad');  // Replace 'pageLoad' with the event name you want to check
    });
  });
  