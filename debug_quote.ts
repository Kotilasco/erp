
import { prisma } from './lib/db';

async function main() {
    const projectId = 'cmldj3l29005mstlwhaellwh0';

    console.log(`Checking quote for project: ${projectId}`);

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            quote: {
                include: {
                    lines: true
                }
            }
        }
    });

    if (!project) {
        console.log('Project not found');
        return;
    }

    const quote = project.quote;
    if (!quote) {
        console.log('No quote linked to project');
        return;
    }

    console.log(`Found Linked quote: ${quote.id}`);
    analyzeQuote(quote);
}

function analyzeQuote(quote: any) {
    console.log(`Total lines: ${quote.lines.length}`);

    let passed = 0;

    quote.lines.forEach((l: any) => {
        const meta = typeof l.metaJson === 'string' ? JSON.parse(l.metaJson || '{}') : (l.metaJson || {});
        const section = (l.section || meta.section || '').toUpperCase();
        const type = (l.itemType || meta.itemType || meta.type || '').toUpperCase();

        const isLabour = type === 'LABOUR' || meta.isLabour === true;
        const matchesSection = section === 'FOUNDATIONS' || section.includes('SUBSTRUCTURE');

        const passes = isLabour && matchesSection;
        if (passes) passed++;

        // Log details for debugging
        if (passes || l.description.toLowerCase().includes('site clearance') || l.description.toLowerCase().includes('excavat')) {
            console.log(`Line: ${l.description.substring(0, 50)}...`);
            console.log(`   Section: '${section}' (Matches: ${matchesSection})`);
            console.log(`   Type: '${type}' (IsLabour: ${isLabour})`);
            console.log(`   PASS: ${passes}`);
            console.log('---');
        }
    });

    console.log(`Total passing lines: ${passed}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
