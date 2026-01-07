
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting migration...');

    // 1. Rename SENIOR_PM -> PROJECT_COORDINATOR
    const seniorPmUpdate = await prisma.user.updateMany({
        where: { role: 'SENIOR_PM' },
        data: { role: 'PROJECT_COORDINATOR' },
    });
    console.log(`Updated ${seniorPmUpdate.count} users from SENIOR_PM to PROJECT_COORDINATOR`);

    // 2. Rename PROJECT_MANAGER -> PROJECT_OPERATIONS_OFFICER
    const pmUpdate = await prisma.user.updateMany({
        where: { role: 'PROJECT_MANAGER' },
        data: { role: 'PROJECT_OPERATIONS_OFFICER' },
    });
    console.log(`Updated ${pmUpdate.count} users from PROJECT_MANAGER to PROJECT_OPERATIONS_OFFICER`);

    // 3. Update specific emails and names
    const specificUpdates = [
        {
            oldEmail: 'seniorpm@example.com',
            newEmail: 'projectcoordinator@example.com',
            newName: 'Project Coordinator'
        },
        {
            oldEmail: 'pm@example.com',
            newEmail: 'ops@example.com',
            newName: 'Project Operations Officer'
        },
        // Also handle case where email was already updated but name wasn't
        {
            oldEmail: 'projectcoordinator@example.com',
            newEmail: 'projectcoordinator@example.com',
            newName: 'Project Coordinator'
        },
        {
            oldEmail: 'ops@example.com',
            newEmail: 'ops@example.com',
            newName: 'Project Operations Officer'
        },
    ];

    for (const { oldEmail, newEmail, newName } of specificUpdates) {
        const user = await prisma.user.findFirst({
            where: { email: { in: [oldEmail, newEmail] } }
        });

        if (user) {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    email: newEmail,
                    name: newName
                },
            });
            console.log(`Updated user ${user.email} -> ${newEmail}, Name: ${newName}`);
        } else {
            console.log(`User ${oldEmail}/${newEmail} not found, skipping.`);
        }
    }

    // 4. Create new users
    const newUsers = [
        { email: 'ops1@example.com', name: 'Operations Officer 1' },
        { email: 'ops2@example.com', name: 'Operations Officer 2' },
    ];

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('Password01', salt, 1000, 64, 'sha512').toString('hex');
    const passwordHash = `${salt}:${hash}`;

    for (const u of newUsers) {
        const existing = await prisma.user.findUnique({ where: { email: u.email } });
        if (!existing) {
            await prisma.user.create({
                data: {
                    email: u.email,
                    name: u.name,
                    role: 'PROJECT_OPERATIONS_OFFICER',
                    passwordHash,
                },
            });
            console.log(`Created user ${u.email}`);
        } else {
            console.log(`User ${u.email} already exists.`);
        }
    }

    console.log('Migration complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
