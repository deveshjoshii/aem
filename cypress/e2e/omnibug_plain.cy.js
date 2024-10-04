describe('Capture Marketing and Analytics Tags', () => {
  it('intercepts and logs various marketing and analytics requests', () => {
      const tagLogs = [];
      const extractedData = {};

      // Intercept all requests and filter for "amexpressenterprise"
      cy.intercept('**', (req) => {
          const url = req.url;
          if (url.includes('amexpressenterprise')) { // Filter for specific requests
              tagLogs.push(`Request: ${url}`);
              
              // Parse the URL to extract parameters
              const urlParams = new URL(url);
              const queryParams = Object.fromEntries(urlParams.searchParams.entries());

              // Extract relevant parameters
              extractedData["Character set"] = queryParams.ce;
              extractedData["Currency code"] = queryParams.cc;
              extractedData["Current URL"] = decodeURIComponent(queryParams.g);
              extractedData["JavaScript Version"] = urlParams.pathname.split('/')[4]; // Extracting JS version from the path
              extractedData["Marketing Cloud Visitor ID"] = queryParams.mid;
              extractedData["Page name"] = queryParams.pageName;
              extractedData["Report Suites"] = urlParams.pathname.split('/')[3]; // Extracting report suite from the path
              extractedData["Server"] = queryParams.server;
              extractedData["Tracking Server"] = urlParams.hostname;
              extractedData["Visitor namespace"] = queryParams.ns;
              extractedData["prop3"] = queryParams.c3;
              extractedData["prop4"] = queryParams.c4;
              extractedData["prop10"] = queryParams.c10;
              extractedData["prop19"] = queryParams.c19;
              extractedData["prop24"] = queryParams.c24;
              extractedData["prop30"] = queryParams.c30;
              extractedData["prop31"] = queryParams.c31;
              extractedData["prop38"] = queryParams.c38;
              extractedData["prop48"] = queryParams.c48;
              extractedData["prop49"] = queryParams.c49;
              extractedData["prop75"] = queryParams.c75;
              extractedData["eVar22"] = queryParams.v22;
              extractedData["eVar27"] = queryParams.v27;
              extractedData["eVar45"] = queryParams.v45;
              extractedData["eVar60"] = queryParams.v60;
              extractedData["eVar61"] = queryParams.v61;
              extractedData["eVar74"] = queryParams.v74;
              extractedData["eVar75"] = queryParams.v75;
              extractedData["eVar82"] = queryParams.v82;
              extractedData["eVar94"] = queryParams.v94;
              extractedData["eVar122"] = queryParams.v122;
              extractedData["eVar140"] = queryParams.v140;
              extractedData["Hierarchy 1"] = queryParams.h1;
              extractedData["cm.ssf"] = queryParams.ssf;
              extractedData["gvs"] = queryParams.gvs;
              extractedData["omn.lob"] = queryParams.lob;
              extractedData["visitorCheck"] = queryParams.visitorCheck;
          }
      }).as('allRequests');

      // Visit the target URL
      cy.visit('https://apply.americanexpress.com/marriottbonvoymclp150/', {
          onBeforeLoad(win) {
              // Stub console.log to capture any console outputs
              cy.stub(win.console, 'log').callsFake((msg) => {
                  tagLogs.push(`Console log: ${msg}`);
              });
          }
      });

      // Wait for a reasonable time for requests to be made
      cy.wait(10000);

      // Log all captured data
      cy.then(() => {
          cy.log('All captured marketing and analytics tags:');
          tagLogs.forEach(log => {
              cy.log(log);
          });

          // Format logs into a table-like structure
          const logContent = tagLogs.map(log => log.replace('Request: ', '')).join('\n');

          // Append logs to a file
          cy.writeFile('cypress/fixtures/marketing_analytics_logs.txt', logContent, { flag: 'a+' });

          // Append extracted data to a file
          const extractedContent = Object.entries(extractedData)
              .map(([key, value]) => `${key}: ${value}`)
              .join('\n');
          cy.writeFile('cypress/fixtures/extracted_data.txt', extractedContent, { flag: 'a+' });
      });

      // Add an assertion to ensure we captured at least one request
      cy.wrap(tagLogs).should('have.length.at.least', 1);
  });
});