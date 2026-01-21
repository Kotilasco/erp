
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Browser Test Data (Append Mode)...');

    const uniqueId = Date.now().toString();

    // 1. Ensure Users exist
    const passwordHash = await bcrypt.hash('Password@123', 10);

    const procurementUser = await prisma.user.upsert({
        where: { email: 'procurement@local.test' },
        update: {},
        create: { email: 'procurement@local.test', role: 'PROCUREMENT', name: 'Procurement Officer', passwordHash },
    });

    await prisma.user.upsert({
        where: { email: 'senior_procurement@local.test' },
        update: {},
        create: { email: 'senior_procurement@local.test', role: 'SENIOR_PROCUREMENT', name: 'Senior Procurement', passwordHash },
    });

    // 2. Create Project
    const project = await prisma.project.create({
        data: {
            status: 'PLANNED',
            createdById: procurementUser.id,
            commenceOn: new Date(),
            installmentDueOn: new Date(),
            quote: {
                create: {
                    number: `QT-TEST-${uniqueId}`, // Unique Number
                    vatBps: 0,
                    createdById: procurementUser.id,
                    customer: {
                        create: {
                            displayName: `Test Customer ${uniqueId}`, // Unique Name
                            email: `customer${uniqueId}@test.com` // Unique Email
                        }
                    },
                    lines: {
                        create: [
                            { description: 'Pit Sand', quantity: 17, unit: 'm3', unitPriceMinor: 1250, lineSubtotalMinor: 21250, lineDiscountMinor: 0, lineTaxMinor: 0, lineTotalMinor: 21250 },
                            { description: 'Cement', quantity: 50, unit: 'bag', unitPriceMinor: 800, lineSubtotalMinor: 40000, lineDiscountMinor: 0, lineTaxMinor: 0, lineTotalMinor: 40000 },
                        ]
                    }
                }
            }
        },
        include: { quote: { include: { lines: true } } }
    });

    console.log(`Created Project: ${project.id}`);

    // 3. Create Procurement Requisition
    const req = await prisma.procurementRequisition.create({
        data: {
            projectId: project.id,
            status: 'SUBMITTED', // Ready for Procurement
            items: {
                // @ts-ignore
                create: project.quote!.lines.map(qi => ({
                    description: qi.description,
                    qty: qi.quantity,
                    unit: qi.unit,
                    amountMinor: qi.lineTotalMinor,
                    quoteLineId: qi.id,
                    qtyRequested: qi.quantity
                }))
            }
        }
    });

    console.log(`Created Requisition: ${req.id}`);
    console.log('Done.');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => await prisma.$disconnect());
