import { NextRequest, NextResponse } from 'next/server';
import { generateDailyReportPdf } from '@/lib/pdf/dailyReportPdf';

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ projectId: string }> }
) {
    try {
        const { searchParams } = new URL(req.url);
        const date = searchParams.get('date');
        const { projectId } = await context.params;

        if (!date) {
            return new NextResponse('Missing date parameter', { status: 400 });
        }

        const { buffer, filename } = await generateDailyReportPdf(projectId, date);

        return new NextResponse(buffer as unknown as BodyInit, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error: any) {
        console.error('PDF Generation Error:', error);
        return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
    }
}
