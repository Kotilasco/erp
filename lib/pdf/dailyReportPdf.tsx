import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { getDailyReportData } from '@/app/(protected)/projects/actions';
import TestDoc from './TestDoc';
import DailyProjectReport from './DailyProjectReport';

export async function generateDailyReportPdf(projectId: string, date: string) {
    console.log('Generating PDF for', projectId, date);
    console.log('React version:', React.version);
    
    // Fetch Data
    const data = await getDailyReportData(projectId, date);
    if (!data || !data.project) {
        throw new Error('Report data not found');
    }

    console.log('PDF DATA DEBUG:', JSON.stringify(data, null, 2));

    // Toggle here to switch between Test and Real report
    const USE_TEST_DOC = false; 

    let element;
    if (USE_TEST_DOC) {
         element = <TestDoc date={date} />;
    } else {
         element = <DailyProjectReport data={data} />;
    }

    // Generate Buffer
    const instance = pdf(element);
    const buffer = await instance.toBuffer();
    const cleanName = data.project.name.replace(/\s+/g, '_');

    return {
        buffer,
        filename: `Daily_Report_${cleanName}_${date}.pdf`
    };
}
