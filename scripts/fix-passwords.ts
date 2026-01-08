
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting password fix...');

    const password = 'Password01';
    const SALT_ROUNDS = 10;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const emailsToReset = [
        'ops1@example.com',
        'ops2@example.com',
        'projectcoordinator@example.com',
        'ops@example.com',
    ];

    for (const email of emailsToReset) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
            await prisma.user.update({
                where: { id: user.id },
                data: { passwordHash },
            });
            console.log(`Updated password for ${email}`);
        } else {
            console.log(`User ${email} not found.`);
        }
    }

    console.log('Password fix complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
