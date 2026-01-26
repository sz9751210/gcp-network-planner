// Test script to verify data export functionality

async function testDataExport() {
  console.log('Testing data export...');

  try {
    // First, check if we have any service accounts
    const credentialsResponse = await fetch('http://localhost:3001/api/credentials');
    if (!credentialsResponse.ok) {
      console.log('No service accounts found. Creating test account...');
      const createResponse = await fetch('http://localhost:3001/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Account',
          serviceAccountKey: JSON.stringify({
            type: 'service_account',
            project_id: 'test-project-id',
            private_key_id: 'test-key-id',
            private_key: 'test-private-key',
            client_email: 'test@example.com',
            auth_uri: 'https://oauth2.googleapis.com/token',
            token_uri: 'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
            client_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
            universe_domain: 'googleapis.com'
          })
        }),
      });

      if (!createResponse.ok) {
        console.error('Failed to create test account');
        return;
      }

      const accountId = (await createResponse.json()).id;
      console.log(`Created test account with ID: ${accountId}`);

    // Test all-data endpoint
    const allDataResponse = await fetch(`http://localhost:3001/api/gcp/all-data?serviceAccountId=${accountId}`);
    console.log(`All data response status: ${allDataResponse.status}`);
    if (allDataResponse.ok) {
      const data = await allDataResponse.json();
      console.log(`Fetched ${data.length} records`);
      if (data.length > 0) {
        console.log('Sample data:', JSON.stringify(data[0], null, 2));
      }
    } else {
      console.log('No data returned');
    }

    // Test export endpoint
    const exportResponse = await fetch('http://localhost:3001/api/gcp/export?serviceAccountId=${accountId}&format=json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'json' }),
    });

    console.log(`Export response status: ${exportResponse.status}`);
    if (exportResponse.ok) {
      const blob = await exportResponse.blob();
      console.log(`Export blob size: ${blob.size} bytes`);
      console.log(`Blob type: ${blob.type}`);
      
      // Save to file for inspection
      const fs = await import('fs');
      await fs.promises.writeFile('./test-export.json', blob);
      console.log('Exported data saved to test-export.json');
    } else {
      console.error('Export failed');
    }

    console.log('Data export functionality test completed!');
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Run the test
testDataExport();
