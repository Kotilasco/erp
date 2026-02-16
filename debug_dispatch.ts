
import { prisma } from './lib/db';

async function main() {
    const dispatchId = 'cmlp6g69x0003jm04nwckgkt8'; // From user screenshot URL
    const projectId = 'cmlmcpxv7003tvqik3ho3dp9x'; // From user screenshot URL in daily-tasks

    console.log('--- Debugging Dispatch ---');
    const dispatch = await prisma.dispatch.findUnique({
        where: { id: dispatchId },
        include: { items: true },
    });

    if (!dispatch) {
        console.log('Dispatch not found:', dispatchId);
        return;
    }

    console.log('Dispatch found:');
    console.log('ID:', dispatch.id);
    console.log('Status:', dispatch.status);
    console.log('ProjectID:', dispatch.projectId);
    console.log('Input ProjectID:', projectId);

    if (dispatch.projectId === projectId) {
        console.log('MATCH: Dispatch belongs to this project.');
    } else {
        console.log('MISMATCH: Dispatch belongs to a DIFFERENT project!');
    }

    console.log('Items:', dispatch.items.length);
    dispatch.items.forEach(item => {
        console.log(`- ${item.description} (Qty: ${item.qty})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
