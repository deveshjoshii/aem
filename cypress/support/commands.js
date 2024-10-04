// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

// cypress/support/commands.js

Cypress.Commands.add('validateAdobeEvent', (eventName) => {
    cy.window().then((win) => {
      // Check if the event exists in the digitalData events
      const eventExists = win.digitalData?.events?.some(event => event.name === eventName);
  
      // Assert that the event exists
      expect(eventExists, `Event "${eventName}" should be triggered`).to.be.true;
    });
  });

  // cypress/support/commands.js

Cypress.Commands.add('validateAdobeEventNetwork', (eventName) => {
    // Intercept the network call for Adobe Analytics
    cy.intercept('POST', '**/b/ss/*').as('adobeEvent'); // URL pattern 
  
    // Wait for the Adobe event to be sent
    cy.wait('@adobeEvent').then((interception) => {
      // Check if the intercepted request includes the event name
      const requestBody = interception.request.body; // Adjust if the event is in headers or another part of the request
  
      // Log the intercepted request for debugging
      cy.log(JSON.stringify(requestBody));
  
      // Validate if the event name exists in the request body
      const eventTriggered = requestBody.includes(eventName); // Adjust this based on the actual request structure
  
      // Assert that the event was triggered
      expect(eventTriggered, `Event "${eventName}" should be triggered`).to.be.true;
    });
  });
  
  