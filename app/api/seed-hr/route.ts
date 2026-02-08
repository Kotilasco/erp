import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const firstNames = [
    'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth',
    'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen',
    'Charles', 'Lisa', 'Daniel', 'Nancy', 'Matthew', 'Betty', 'Anthony', 'Sandra', 'Mark', 'Margaret',
    'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
    'Kenneth', 'Dorothy', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa', 'Timothy', 'Deborah',
    'Ronald', 'Stephanie', 'Edward', 'Rebecca', 'Jason', 'Sharon', 'Jeffrey', 'Laura', 'Ryan', 'Cynthia',
    'Jacob', 'Kathleen', 'Gary', 'Amy', 'Nicholas', 'Angela', 'Eric', 'Shirley', 'Jonathan', 'Anna',
    'Stephen', 'Brenda', 'Larry', 'Pamela', 'Justin', 'Nicole', 'Scott', 'Emma', 'Brandon', 'Helen',
    'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Gregory', 'Christine', 'Alexander', 'Debra', 'Frank', 'Rachel',
    'Patrick', 'Carolyn', 'Raymond', 'Janet', 'Jack', 'Catherine', 'Dennis', 'Maria', 'Jerry', 'Heather'
];

const surnames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
    'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
    'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
    'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes'
];

const roles = [
    { role: 'BUILDER', count: 30 },
    { role: 'ASSISTANT', count: 50 },
    { role: 'PLASTERER', count: 10 },
    { role: 'EXCAVATOR', count: 5 },
    { role: 'SUPERVISOR', count: 5 }
];

const offices = ['Office A', 'Office B', 'HQ'];

export async function GET() {
    try {
        console.log('[API/SEED-HR] Starting employee seed...');

        const employeesToCreate = [];
        let roleIdx = 0;
        let roleCount = 0;

        for (let i = 1; i <= 100; i++) {
            const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
            const surname = surnames[Math.floor(Math.random() * surnames.length)];
            const ecNumber = `EM-${i.toString().padStart(4, '0')}`;

            if (roleCount >= roles[roleIdx].count) {
                roleIdx++;
                roleCount = 0;
            }
            const role = roles[roleIdx].role;
            roleCount++;

            const office = offices[Math.floor(Math.random() * offices.length)];
            const email = `${firstName.toLowerCase()}.${surname.toLowerCase()}.${i}@example.com`;

            employeesToCreate.push({
                givenName: firstName,
                surname: surname,
                ecNumber: ecNumber,
                role: role,
                office: office,
                email: email,
                status: 'ACTIVE'
            });
        }

        console.log(`[API/SEED-HR] Creating ${employeesToCreate.length} employees...`);

        // Use a transaction to ensure all are created or none
        await prisma.$transaction(
            employeesToCreate.map(emp =>
                prisma.employee.upsert({
                    where: { ecNumber: emp.ecNumber },
                    update: emp,
                    create: emp
                })
            )
        );

        console.log('[API/SEED-HR] Employee seeding completed successfully.');
        return NextResponse.json({
            success: true,
            message: `Seeded ${employeesToCreate.length} employees successfully.`
        });

    } catch (error: any) {
        console.error('[API/SEED-HR] Failed:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
