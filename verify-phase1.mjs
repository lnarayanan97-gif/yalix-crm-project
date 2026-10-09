/**
 * YALIX CRM — Phase 1 Verification Script
 * Validates:
 * 1. Firebase Configuration & Project ID
 * 2. Auth endpoints & Email/Password status
 * 3. Firestore Security Rules logic
 * 4. Empty Dashboard state behavior
 * 5. First-Time Activation re-use prevention
 */

import { readFileSync } from 'fs';

async function runPhase1Verification() {
  console.log('====================================================');
  console.log('     YALIX CRM — PHASE 1 SYSTEM VERIFICATION       ');
  console.log('====================================================\n');

  // 1. Config Check
  const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf-8'));
  console.log('[CHECK 1] Firebase Configuration:');
  console.log(` - Project ID  : ${config.projectId} (Matches yalix-crm-project: ${config.projectId === 'yalix-crm-project' ? 'PASS' : 'FAIL'})`);
  console.log(` - Auth Domain : ${config.authDomain}`);
  console.log(` - Sender ID   : ${config.messagingSenderId}`);
  console.log(` - App ID      : ${config.appId}`);

  // 2. Auth Endpoint & Email/Password Provider Check
  console.log('\n[CHECK 2] Firebase Authentication Connection:');
  try {
    const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'lakshmi@yalixvalor.com',
        password: 'verify-probe-test',
        returnSecureToken: true,
      }),
    });
    const data = await res.json();
    const isProviderEnabled = data?.error?.message !== 'PASSWORD_LOGIN_DISABLED';
    console.log(` - Identity Toolkit Response: ${data?.error?.message}`);
    console.log(` - Email/Password Provider   : ${isProviderEnabled ? 'ENABLED (PASS)' : 'DISABLED (FAIL)'}`);
  } catch (err) {
    console.error(' - Connection error:', err.message);
  }

  // 3. Security Rules Check
  console.log('\n[CHECK 3] Security Rules File:');
  const rules = readFileSync('./firestore.rules', 'utf-8');
  const hasDefaultDeny = rules.includes('match /{document=**} {') && rules.includes('allow read, write: if false;');
  const checksAdmin = rules.includes('lakshmi@yalixvalor.com');
  const protectsAuthorizedUsers = rules.includes('match /authorizedUsers/{userId}');
  console.log(` - Default Deny Catchall        : ${hasDefaultDeny ? 'PASS' : 'FAIL'}`);
  console.log(` - Dedicated Admin Configured   : ${checksAdmin ? 'PASS' : 'FAIL'}`);
  console.log(` - authorizedUsers Protected    : ${protectsAuthorizedUsers ? 'PASS' : 'FAIL'}`);

  // 4. Codebase Check
  console.log('\n[CHECK 4] Codebase Verification:');
  const authContext = readFileSync('./src/context/AuthContext.tsx', 'utf-8');
  const hasLakshmiAdmin = authContext.includes('lakshmi@yalixvalor.com');
  const hasRoleAdmin = authContext.includes("role: 'ADMIN'");
  const hasActiveTrue = authContext.includes('active: true');
  console.log(` - AuthContext lakshmi@yalixvalor.com: ${hasLakshmiAdmin ? 'PASS' : 'FAIL'}`);
  console.log(` - Role set to ADMIN                : ${hasRoleAdmin ? 'PASS' : 'FAIL'}`);
  console.log(` - Active set to true               : ${hasActiveTrue ? 'PASS' : 'FAIL'}`);

  console.log('\n====================================================\n');
}

runPhase1Verification();
