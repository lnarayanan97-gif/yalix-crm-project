/**
 * Diagnostic test script to verify Firebase project configuration
 * and Email/Password authentication status.
 *
 * Usage:
 *   node diagnose-auth.mjs
 */

import { readFileSync } from 'fs';

async function runDiagnostic() {
  console.log('====================================================');
  console.log('   YALIX CRM — Firebase Authentication Diagnostic   ');
  console.log('====================================================\n');

  let config;
  try {
    const raw = readFileSync('./firebase-applet-config.json', 'utf-8');
    config = JSON.parse(raw);
  } catch (err) {
    console.error('FAILED to load firebase-applet-config.json:', err.message);
    process.exit(1);
  }

  const maskedKey = config.apiKey
    ? `${config.apiKey.substring(0, 6)}...${config.apiKey.substring(config.apiKey.length - 4)}`
    : '(missing)';

  console.log(`1. Active Project ID        : ${config.projectId}`);
  console.log(`2. Active Auth Domain       : ${config.authDomain}`);
  console.log(`3. Active App ID            : ${config.appId}`);
  console.log(`4. Messaging Sender ID      : ${config.messagingSenderId}`);
  console.log(`5. Active API Key (Masked)  : ${maskedKey}`);
  console.log(`6. Target Expected ID       : yalix-crm-project`);
  console.log(`   Project ID Match         : ${config.projectId === 'yalix-crm-project' ? 'YES' : 'NO'}`);

  console.log('\n7. Testing Email/Password Provider status with Identity Toolkit API...');

  try {
    const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'lakshmi@yalixvalor.com',
        password: 'check-auth-provider-status-probe',
        returnSecureToken: true,
      }),
    });

    const data = await response.json();

    if (data.error) {
      const code = data.error.message;
      console.log(`   Identity Toolkit Response: ${code}`);

      if (code === 'PASSWORD_LOGIN_DISABLED' || code === 'OPERATION_NOT_ALLOWED') {
        console.log('\n   [DIAGNOSIS]: auth/operation-not-allowed (PASSWORD_LOGIN_DISABLED)');
        console.log('   Notice: The API key currently in use is rejected by Identity Toolkit');
        console.log('   because Email/Password authentication is disabled for this key/project.');
      } else if (code === 'EMAIL_NOT_FOUND' || code === 'INVALID_LOGIN_CREDENTIALS') {
        console.log('\n   [DIAGNOSIS]: Email/Password provider is ENABLED on this project.');
        console.log('   (Endpoint accepted the provider and validated the user lookup.)');
      } else if (code === 'API_KEY_INVALID') {
        console.log('\n   [DIAGNOSIS]: API Key is invalid or restricted.');
      } else {
        console.log(`\n   [RESPONSE CODE]: ${code}`);
      }
    } else {
      console.log('\n   [SUCCESS]: Authentication endpoint active and verified.');
    }
  } catch (netErr) {
    console.error('   Network error while contacting Firebase:', netErr.message);
  }

  console.log('\n====================================================\n');
}

runDiagnostic();
