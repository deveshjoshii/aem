// run-tests.js

const { execSync } = require('child_process');

// Get command-line arguments
const args = process.argv.slice(2);
const testFile = args[0]; // Get the command-line argument

// Validate the input parameter
if (!testFile || (testFile !== 'omnibug_events' && testFile !== 'omnibug_plain')) {
  throw new Error("Please provide a valid test file parameter: 'omnibug_events' or 'omnibug_plain'");
}

// Map the input parameter to the corresponding test file
const fileToRun = testFile === 'omnibug_events' ? 'omnibug_events.cy.js' : 'omnibug_plain.cy.js';

// Construct the command to run Cypress with the specific test file
const command = `npx cypress run --spec "cypress/e2e/${fileToRun}" --headed`;

// Execute the command
try {
  execSync(command, { stdio: 'inherit' });
} catch (error) {
  console.error(`Error executing command: ${error.message}`);
}
