const fs = require('fs');
fs.writeFileSync('debug_projects_start.txt', 'Script started');

const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Manually load .env
try {
    const envPath = path.resolve(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim().replace(/^"(.*)"$/, '$1'); // simpler handling
                if (key && !process.env[key]) {
                    process.env[key] = val;
                }
            }
        });
    }
} catch (e) {
    fs.writeFileSync('debug_projects_error.txt', 'Error loading .env: ' + e.toString());
}

const prisma = new PrismaClient();

async function main() {
    try {
        fs.appendFileSync('debug_projects_start.txt', '\nConnecting...');
        const projects = await prisma.project.findMany({
            select: {
                id: true,
                name: true,
                status: true,
                schedule: { select: { id: true } }
            }
        });

        console.log('Projects:', projects);
        fs.writeFileSync('debug_output.json', JSON.stringify(projects, null, 2));
        fs.appendFileSync('debug_projects_start.txt', '\nDone.');
    } catch (e) {
        console.error(e);
        fs.writeFileSync('debug_error.txt', e.toString());
    } finally {
        await prisma.$disconnect();
    }
}

main();
