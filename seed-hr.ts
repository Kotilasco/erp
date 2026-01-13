
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'hr@example.com';
    const password = 'Password01';
    const hashedPassword = await bcrypt.hash(password, 10);

    const role = 'HUMAN_RESOURCE';

    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
        await prisma.user.create({
            data: {
                email,
                name: 'Human Resource',
                role,
                passwordHash: hashedPassword,
                office: 'HQ',
            },
        });
        console.log(`User ${email} created with role ${role}`);
    } else {
        await prisma.user.update({
            where: { email },
            data: { role, passwordHash: hashedPassword },
        });
        console.log(`User ${email} updated to role ${role}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
