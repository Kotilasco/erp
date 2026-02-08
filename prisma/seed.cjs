const fs = require('fs');
const path = require('path');

const logFile = path.resolve(__dirname, '..', 'seed-debug.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  console.log(msg);
}

log('Script started');

try {
  require('dotenv').config();
} catch (e) {
  // dotenv not found, try manual parsing
  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      log('Manual .env loading...');
      const data = fs.readFileSync(envPath, 'utf8');
      data.split(/\r?\n/).forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  } catch (err) {
    log('Failed to load .env manually: ' + err);
  }
}
log('Script initialized.');

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || 'Password01';

// Revert to POOLED url because non-pooling seems blocked on this network
// But keep the FQDN fix (trailing dot) to prevent DNS hijacking (.CO.ZW)
const nonPooling = process.env.POSTGRES_POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL_NON_POOLING;
const pooledUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;

// CHANGE: Prefer POOLED first, since 'db push' worked and it uses pooled.
let connectionUrl = pooledUrl || nonPooling;

if (!connectionUrl) {
  log(`Missing POSTGRES_PRISMA_URL (or DATABASE_URL). keys: ${Object.keys(process.env).filter(k => k.includes('URL')).join(', ')}`);
  process.exit(1);
}

// Add timeout
if (!connectionUrl.includes('connect_timeout')) {
  const separator = connectionUrl.includes('?') ? '&' : '?';
  connectionUrl += `${separator}connect_timeout=10`;
}

// FORCE FQDN: Append trailing dot to hostname if missing
try {
  // Simple regex to find hostname in postgresql://...
  const match = connectionUrl.match(/@([^/:?]+)([:/?]|$)/);
  if (match) {
    const originalHost = match[1];
    if (!originalHost.endsWith('.')) {
      const fqdnHost = originalHost + '.';
      connectionUrl = connectionUrl.replace(originalHost, fqdnHost);
      log(`Forcing FQDN on POOLED url: ${originalHost} -> ${fqdnHost}`);
    }
  }
} catch (e) {
  log(`Failed to force FQDN: ${e.message}`);
}

const flavor = (connectionUrl === nonPooling) ? 'NON-POOLING' : 'POOLED';
log(`Using ${flavor} connection string (starts with ${connectionUrl.substring(0, 25)}...)`);

// Instantiate Prisma with explicit datasourceUrl to avoid env name drift
const prisma = new PrismaClient({
  datasourceUrl: connectionUrl,
  log: ['warn', 'error'], // minimal log
});


const toMinor = (amount, scale = 2) => BigInt(Math.round(Number(amount ?? 0) * Math.pow(10, scale)));

async function upsertUser({ email, name, role, office, password }) {
  log(`> Upserting user: ${email}`);
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;
  const t0 = Date.now();
  const result = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role,
      office,
      ...(passwordHash ? { passwordHash } : {}),
    },
    create: {
      email,
      name,
      role,
      office,
      passwordHash,
    },
  });
  const t1 = Date.now();
  log(`> Upserted ${email} in ${t1 - t0}ms`);
  return result;
}

async function main() {
  log('Starting...');
  // Connectivity probe (gives a clean error if DB is unreachable)
  try {
    await prisma.$queryRaw`SELECT 1`;
    log('Database connection successful.');
  } catch (getConnectionError) {
    log('Failed to connect to DB: ' + getConnectionError);
    throw getConnectionError;
  }

  const sharedPassword = DEFAULT_PASSWORD;

  // Users
  log('Upserting System user...');
  const system = await upsertUser({ email: 'system@local', name: 'System', role: 'ADMIN', office: 'HQ', password: null });
  log('System user upserted.');

  log('Upserting other users...');
  await Promise.all([
    upsertUser({ email: 'qs@example.com', name: 'QS User', role: 'QS', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'senior@example.com', name: 'Senior QS', role: 'SENIOR_QS', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'sales@example.com', name: 'Sales User', role: 'SALES', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'pm@example.com', name: 'Project Manager', role: 'PROJECT_MANAGER', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'teamlead@example.com', name: 'Project Team Lead', role: 'PROJECT_TEAM', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'seniorpm@example.com', name: 'Senior PM', role: 'SENIOR_PM', office: 'Office A', password: sharedPassword }),

    upsertUser({ email: 'admin@example.com', name: 'Admin', role: 'ADMIN', office: 'HQ', password: sharedPassword }),
    upsertUser({ email: 'client@example.com', name: 'Client', role: 'CLIENT', office: null, password: sharedPassword }),
    upsertUser({ email: 'procurement@example.com', name: 'Procurement', role: 'PROCUREMENT', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'accounts@example.com', name: 'Accounts', role: 'ACCOUNTS', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'security@example.com', name: 'Security', role: 'SECURITY', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'driver@example.com', name: 'Driver', role: 'DRIVER', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'accounting_clerk@example.com', name: 'Accounting Clerk', role: 'ACCOUNTING_CLERK', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'accounting_officer@example.com', name: 'Accounting Officer', role: 'ACCOUNTING_OFFICER', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'accounting_auditor@example.com', name: 'Accounting Auditor', role: 'ACCOUNTING_AUDITOR', office: 'Office A', password: sharedPassword }),
  ]);

  // Default customer
  const customer = await prisma.customer.upsert({
    where: { id: 'seed-default' },
    update: {
      displayName: 'Walk-in Customer',
      addressJson: { street: '—', city: '—' }, // object, not string
    },
    create: {
      id: 'seed-default',
      displayName: 'Walk-in Customer',
      email: null,
      phone: null,
      // On Postgres you can switch to Json if your schema uses it; for SQLite keep String
      addressJson: { street: '—', city: '—' }, // object, not string
    },
  });

  // Product (prefer basePriceMinor BigInt; fallback to legacy basePrice String if needed)
  try {
    await prisma.product.upsert({
      where: { sku: 'SAMPLE-001' },
      update: { name: 'Sample Item', unit: 'ea', basePriceMinor: toMinor(100), extraJson: null },
      create: { sku: 'SAMPLE-001', name: 'Sample Item', unit: 'ea', basePriceMinor: toMinor(100), extraJson: null },
    });
  } catch (e) {
    const msg = (e && e.message) || '';
    if (msg.includes('Unknown arg `basePriceMinor`') || msg.includes('no such column: basePriceMinor')) {
      log('Falling back to legacy product schema (basePrice as String).');
      await prisma.product.upsert({
        where: { sku: 'SAMPLE-001' },
        update: { name: 'Sample Item', unit: 'ea', basePrice: '100.0000', extraJson: null },
        create: { sku: 'SAMPLE-001', name: 'Sample Item', unit: 'ea', basePrice: '100.0000', extraJson: null },
      });
    } else {
      throw e;
    }
  }

  log(`Done: systemId=${system.id}, customerId=${customer.id}, defaultPassword=${sharedPassword}`);
}

main()
  .catch((e) => {
    log('Failed: ' + (e?.stack || e));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });