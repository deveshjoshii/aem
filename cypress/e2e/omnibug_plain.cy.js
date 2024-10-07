describe('Intercept request, stringify, and decode key-value pairs', () => {
    it('Intercepts, stringifies the request, and formats key-value pairs', () => {
      // Visit the page
      cy.visit('https://apply.americanexpress.com/en-us/hil-lto-q3/page/30');
  
      // Intercept the request containing "/b/ss/"
      cy.intercept('GET', '**/b/ss/**').as('specificRequest');
  
      // Wait for the intercepted request
      cy.wait('@specificRequest', { timeout: 10000 }).then((interception) => {
        // Get the intercepted URL
        const interceptedUrl = interception.request.url;
  
        // Extract the query string
        const queryString = interceptedUrl.split('?')[1]; // Get everything after "?"
  
        // Decode the query string
        const decodedQuery = decodeURIComponent(queryString);
        const keyValuePairs = decodedQuery.split('&');
  
        // Create an object to store key-value pairs
        const extractedData = {};
  
        // Extract values based on expected keys
        keyValuePairs.forEach(pair => {
          const [key, value] = pair.split('=');
          extractedData[key] = value || '';  // Store the key-value pair in the object
        });
  
        // Log extracted variables for debugging
        cy.log('Extracted Variables:', extractedData);
        console.log('Extracted Variables:', extractedData); // Log to console for better visibility
  
        // Define the header keys including prop22
        const headerKeys = [
          'ce',                     // Character set
          'cc',                     // Currency code
          'g',                      // Current URL
          'v',                      // JavaScript Version
          'mid',                    // Marketing Cloud Visitor ID
          'pageName',               // Page name
          'rs',                     // Report Suites
          'server',                 // Server
          't',                      // Tracking Server
          'ns',                     // Visitor namespace
          'c3',                     // prop3
          'c4',                     // prop4
          'c10',                    // prop10
          'c19',                    // prop19
          'c24',                    // prop24
          'c30',                    // prop30
          'c31',                    // prop31
          'c38',                    // prop38
          'c46',                    // prop46
          'c48',                    // prop48
          'c49',                    // prop49
          'c56',                    // prop56
          'c57',                    // prop57
          'c58',                    // prop58
          'c75',                    // prop75
          'v22',                    // eVar22
          'v27',                    // eVar27
          'v41',                    // eVar41
          'v45',                    // eVar45
          'v60',                    // eVar60
          'v61',                    // eVar61
          'v74',                    // eVar74
          'v75',                    // eVar75
          'v94',                    // eVar94
          'v122',                   // eVar122
          'v140',                   // eVar140
          'h1',                     // Hierarchy 1
          'ssf',                    // cm.ssf
          'lob',                    // omn.lob
          'visitorCheck',           // visitorCheck
          'bh',                     // Browser height
          't',                      // Browser time
          'bw',                     // Browser width
          'cl',                     // Cookie lifetime
          'c',                      // Cookies enabled?
          'j',                      // Image sent from JS?
          'mcorgid',                // mcorgid
          'pf',                     // pf
          'c3',                     // Screen color depth
          's',                      // Screen resolution
          'prop22'                 // Include prop22
        ];
  
        // Create an object to hold the final data using the header keys
        const finalData = {};
  
        // Populate finalData with values from extractedData
        headerKeys.forEach(key => {
          finalData[key] = extractedData[key] || '';  // Assign the value from extractedData if it exists
        });
  
        // Log final data to verify the values before writing to CSV
        cy.log('Final Data:', finalData);
        console.log('Final Data:', finalData); // Log to console for better visibility
  
        // Convert the key-value pairs to CSV format
        const csvHeader = headerKeys.join(',') + '\n';
        const csvRow = headerKeys.map(key => finalData[key]).join(',') + '\n';
  
        // Write to CSV (using cy.task, plugin should be configured)
        cy.task('writeToCSV', csvHeader + csvRow);
      });
  
      // Optionally, close the browser after the request
      cy.window().then((win) => {
        win.close();
      });
    });
  });
  