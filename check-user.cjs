const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
    const user = await prisma.user.findUnique({
        where: { email: 'salesaccount@example.com' }
    });
    if (user) {
        console.log('✅ User found:', JSON.stringify(user, null, 2));
    } else {
        console.log('❌ User not found');
    }
    await prisma.$disconnect();
}

checkUser();
