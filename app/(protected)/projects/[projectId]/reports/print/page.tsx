
import { getProjectReportData, ReportData } from '../actions';
import ReportPrintHeader from '@/components/reports/ReportPrintHeader';
import DeliveriesReport from '../components/DeliveriesReport';
import MaterialReconciliationReport from '../components/MaterialReconciliationReport';
import ProfitabilityReport from '../components/ProfitabilityReport';
import { prisma } from '@/lib/db';

async function getProjectDetails(projectId: string) {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { 
            quote: {
                include: {
                    customer: true
                }
            }
        }
    });
    return project;
}

export default async function ReportPrintPage({ params, searchParams }: { 
    params: Promise<{ projectId: string }>, 
    searchParams: Promise<{ reportType?: string }> 
}) {
    const { projectId } = await params;
    const resolvedSearchParams = await searchParams;
    const reportType = resolvedSearchParams.reportType || 'PROFITABILITY';
    const data = await getProjectReportData(projectId);
    const project = await getProjectDetails(projectId);

    const titleMap: Record<string, string> = {
        'DELIVERIES': 'Deliveries Report',
        'RECONCILIATION': 'Material Reconciliation',
        'PROFITABILITY': 'Profitability Report'
    };

    return (
        <div className="p-8 bg-white min-h-screen text-black print:p-4 print:landscape">
            <ReportPrintHeader 
                title={titleMap[reportType] || 'Project Report'} 
                subTitle={`${project?.name} - ${project?.quote?.customer?.name || 'Unknown Customer'}`}
            />

            
            <div className="mt-8">
                {reportType === 'DELIVERIES' && <DeliveriesReport data={data} disablePagination={true} />}
                {reportType === 'RECONCILIATION' && <MaterialReconciliationReport data={data} disablePagination={true} />}
                {reportType === 'PROFITABILITY' && <ProfitabilityReport data={data} disablePagination={true} />}
            </div>

            <script dangerouslySetInnerHTML={{ __html: 'window.print();' }} />
        </div>
    );
}
