import { PrintButton } from './PrintButton';
import { getDailyReportData } from '@/app/(protected)/projects/actions';
import { DailyProjectReportView } from '../../daily-tasks/components/DailyProjectReportView';

export default async function DailyReportPage({ 
    params, 
    searchParams 
}: { 
    params: Promise<{ projectId: string }>;
    searchParams: Promise<{ date: string }>;
}) {
    const { projectId } = await params;
    const { date } = await searchParams;

    if (!date) {
        return <div className="p-8 text-red-500">Date parameter is missing.</div>;
    }

    const data = await getDailyReportData(projectId, date);

    if (!data || !data.project) {
        return <div className="p-8 text-red-500">Report data not found for {date}.</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
             {/* Print Controls - Hidden when Printing */}
             <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden px-4 sm:px-0">
                <h2 className="text-lg font-semibold text-gray-700">Report Preview</h2>
                <PrintButton />
             </div>

             <DailyProjectReportView data={data} />
        </div>
    );
}
