import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

interface JWTSecrets {
  current: string;
  previous?: string;
  rotatedAt: Date;
}

const SECRETS_FILE = path.join(process.cwd(), '.jwt-secrets.json');

// Generate a cryptographically secure secret
export const generateJWTSecret = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

// Load JWT secrets from file or create new ones
export const loadJWTSecrets = async (): Promise<JWTSecrets> => {
  try {
    const data = await fs.readFile(SECRETS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist, create new secrets
    const secrets: JWTSecrets = {
      current: process.env.JWT_SECRET || generateJWTSecret(),
      rotatedAt: new Date()
    };
    await saveJWTSecrets(secrets);
    return secrets;
  }
};

// Save JWT secrets to file
export const saveJWTSecrets = async (secrets: JWTSecrets): Promise<void> => {
  await fs.writeFile(SECRETS_FILE, JSON.stringify(secrets, null, 2));
};

// Rotate JWT secret
export const rotateJWTSecret = async (): Promise<JWTSecrets> => {
  const currentSecrets = await loadJWTSecrets();
  
  const newSecrets: JWTSecrets = {
    current: generateJWTSecret(),
    previous: currentSecrets.current,
    rotatedAt: new Date()
  };
  
  await saveJWTSecrets(newSecrets);
  
  // Update environment variable for current process
  process.env.JWT_SECRET = newSecrets.current;
  
  return newSecrets;
};

// Get current JWT secret
export const getCurrentJWTSecret = async (): Promise<string> => {
  const secrets = await loadJWTSecrets();
  return secrets.current;
};

// Get all valid JWT secrets (current + previous for grace period)
export const getValidJWTSecrets = async (): Promise<string[]> => {
  const secrets = await loadJWTSecrets();
  const validSecrets = [secrets.current];
  
  // Include previous secret if rotation was recent (within 24 hours)
  if (secrets.previous) {
    const rotationAge = Date.now() - new Date(secrets.rotatedAt).getTime();
    const gracePeriod = 24 * 60 * 60 * 1000; // 24 hours
    
    if (rotationAge < gracePeriod) {
      validSecrets.push(secrets.previous);
    }
  }
  
  return validSecrets;
};