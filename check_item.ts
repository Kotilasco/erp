import { prisma } from './lib/db';

async function main() {
  const item = await prisma.procurementRequisitionItem.findFirst({
    where: { description: 'River sand' },
    include: { quoteLine: true }
  });
  console.log(JSON.stringify(item, null, 2));
}

main();
