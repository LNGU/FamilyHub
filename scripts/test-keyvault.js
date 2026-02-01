// Test Azure Key Vault connection with Managed Identity
// Run with: node scripts/test-keyvault.js

const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

require('dotenv').config();

async function testKeyVault() {
  const vaultUrl = process.env.AZURE_KEY_VAULT_URL;
  
  if (!vaultUrl) {
    console.error('❌ AZURE_KEY_VAULT_URL not set in .env');
    process.exit(1);
  }
  
  console.log('🔐 Testing Azure Key Vault connection...');
  console.log(`   Vault URL: ${vaultUrl}`);
  
  try {
    // DefaultAzureCredential tries multiple auth methods:
    // 1. Environment variables (AZURE_CLIENT_ID, etc.)
    // 2. Managed Identity (when deployed)
    // 3. VS Code Azure extension
    // 4. Azure CLI (az login)
    // 5. Azure PowerShell
    const credential = new DefaultAzureCredential();
    const client = new SecretClient(vaultUrl, credential);
    
    const testSecretName = 'test-familyhub-connection';
    const testSecretValue = `test-value-${Date.now()}`;
    
    // Test WRITE
    console.log('\n📝 Testing WRITE...');
    console.log(`   Setting secret: ${testSecretName}`);
    await client.setSecret(testSecretName, testSecretValue, {
      tags: {
        purpose: 'connection-test',
        createdAt: new Date().toISOString(),
      }
    });
    console.log('   ✅ Write successful!');
    
    // Test READ
    console.log('\n📖 Testing READ...');
    const retrieved = await client.getSecret(testSecretName);
    console.log(`   Retrieved value: ${retrieved.value}`);
    
    if (retrieved.value === testSecretValue) {
      console.log('   ✅ Read successful! Values match.');
    } else {
      console.log('   ⚠️ Values do not match!');
    }
    
    // Test LIST
    console.log('\n📋 Testing LIST...');
    let count = 0;
    for await (const secretProperties of client.listPropertiesOfSecrets()) {
      count++;
      if (count <= 5) {
        console.log(`   - ${secretProperties.name} (created: ${secretProperties.createdOn})`);
      }
    }
    console.log(`   ✅ Found ${count} secret(s) total`);
    
    // Cleanup
    console.log('\n🧹 Cleaning up test secret...');
    await client.beginDeleteSecret(testSecretName);
    console.log('   ✅ Deletion initiated (soft delete)');
    
    console.log('\n✅ All Key Vault operations successful!');
    console.log('\n💡 Your app should now be able to store secure info.');
    
  } catch (error) {
    console.error('\n❌ Key Vault test failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.message.includes('AADSTS')) {
      console.error('\n💡 Authentication issue. Try:');
      console.error('   1. Install Azure CLI: winget install Microsoft.AzureCLI');
      console.error('   2. Run: az login');
      console.error('   3. Run this test again');
    } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
      console.error('\n💡 Permission issue. Ensure your identity has:');
      console.error('   - Key Vault Secrets Officer role, OR');
      console.error('   - Access policy with Get, List, Set, Delete permissions');
    } else if (error.message.includes('404') || error.message.includes('not found')) {
      console.error('\n💡 Key Vault not found. Check:');
      console.error(`   - AZURE_KEY_VAULT_URL is correct: ${vaultUrl}`);
      console.error('   - The Key Vault exists in your Azure subscription');
    }
    
    process.exit(1);
  }
}

testKeyVault();
