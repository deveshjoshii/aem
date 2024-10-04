// cypress/integration/adobeEventNetwork.spec.js
describe('Adobe Analytics Network Event Test', () => {
    it('should validate if the given Adobe event is triggered via network log', () => {
      cy.visit('https://www.americanexpress.com/en-in/');  // Replace with your website
  
      
      // Validate if the Adobe event 'eventName' was triggered
      cy.validateAdobeEventNetwork('pageview');  // Replace 'eventName' with the actual event you want to check
    });
  });
  