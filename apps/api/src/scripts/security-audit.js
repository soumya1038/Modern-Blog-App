#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

console.log('🔒 Running Security Audit...\n');

let exitCode = 0;

// 1. Check npm audit
console.log('1. Running npm audit...');
try {
  const auditResult = execSync('npm audit --audit-level=critical', { encoding: 'utf8' });
  console.log('✅ No critical vulnerabilities found');
} catch (error) {
  console.log('❌ Critical vulnerabilities found:');
  console.log(error.stdout);
  exitCode = 1;
}

// 2. Check for security middleware
console.log('\n2. Checking security middleware...');
const indexPath = path.join(__dirname, '../index.ts');
const indexContent = fs.readFileSync(indexPath, 'utf8');

const securityChecks = [
  { name: 'Helmet', pattern: /helmetConfig/, required: true },
  { name: 'CORS', pattern: /corsConfig/, required: true },
  { name: 'Rate Limiting', pattern: /generalRateLimit/, required: true },
  { name: 'Input Sanitization', pattern: /sanitizeInput/, required: true },
  { name: 'HPP Protection', pattern: /hppConfig/, required: true }
];

securityChecks.forEach(check => {
  if (check.pattern.test(indexContent)) {
    console.log(`✅ ${check.name} configured`);
  } else if (check.required) {
    console.log(`❌ ${check.name} missing`);
    exitCode = 1;
  } else {
    console.log(`⚠️  ${check.name} optional but recommended`);
  }
});

// 3. Check bcrypt rounds
console.log('\n3. Checking bcrypt configuration...');
const authPath = path.join(__dirname, '../routes/auth.ts');
const authContent = fs.readFileSync(authPath, 'utf8');

if (authContent.includes('bcrypt.hash(password, 12)')) {
  console.log('✅ Bcrypt using 12 rounds');
} else if (authContent.includes('bcrypt.hash')) {
  console.log('⚠️  Bcrypt rounds may be insufficient');
} else {
  console.log('❌ Bcrypt not found');
  exitCode = 1;
}

// 4. Check JWT secret rotation
console.log('\n4. Checking JWT secret rotation...');
const jwtPath = path.join(__dirname, '../utils/jwtRotation.ts');
if (fs.existsSync(jwtPath)) {
  console.log('✅ JWT secret rotation implemented');
} else {
  console.log('❌ JWT secret rotation missing');
  exitCode = 1;
}

// 5. Check environment variables
console.log('\n5. Checking environment security...');
const requiredEnvVars = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'MONGODB_URI'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length === 0) {
  console.log('✅ Required environment variables set');
} else {
  console.log(`❌ Missing environment variables: ${missingEnvVars.join(', ')}`);
  console.log('💡 Make sure .env file exists in project root');
  exitCode = 1;
}

// 6. Check for hardcoded secrets
console.log('\n6. Scanning for hardcoded secrets...');
const dangerousPatterns = [
  /password\s*=\s*['"][^'"]{8,}['"]/i,
  /secret\s*=\s*['"][^'"]{16,}['"]/i,
  /api[_-]?key\s*=\s*['"][^'"]{16,}['"]/i,
  /token\s*=\s*['"][^'"]{20,}['"]/i
];

const srcDir = path.join(__dirname, '..');
const files = getAllFiles(srcDir, ['.ts', '.js']);

let secretsFound = false;
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  dangerousPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      console.log(`⚠️  Potential hardcoded secret in ${path.relative(srcDir, file)}`);
      secretsFound = true;
    }
  });
});

if (!secretsFound) {
  console.log('✅ No hardcoded secrets detected');
}

// 7. Check CORS configuration
console.log('\n7. Checking CORS configuration...');
const securityPath = path.join(__dirname, '../middleware/security.ts');
const securityContent = fs.readFileSync(securityPath, 'utf8');

if (securityContent.includes('allowedOrigins')) {
  console.log('✅ CORS whitelist configured');
} else {
  console.log('❌ CORS whitelist missing');
  exitCode = 1;
}

// Summary
console.log('\n' + '='.repeat(50));
if (exitCode === 0) {
  console.log('🎉 Security audit passed!');
} else {
  console.log('🚨 Security audit failed! Please fix the issues above.');
}
console.log('='.repeat(50));

process.exit(exitCode);

// Helper function to get all files recursively
function getAllFiles(dir, extensions) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      files.push(...getAllFiles(fullPath, extensions));
    } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
      files.push(fullPath);
    }
  });
  
  return files;
}