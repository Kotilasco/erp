'use client';

import { BlobProvider } from '@react-pdf/renderer';
import DailyProjectReport from '@/lib/pdf/DailyProjectReport';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Document, Page, View, Text } from '@react-pdf/renderer';

const MinimalDoc = () => (
  <Document>
    <Page size="A4">
      <View>
        <Text>Hello World Test - Dynamic Import Works</Text>
      </View>
    </Page>
  </Document>
);

// Toggle this to test real report vs minimal
const USE_REAL_REPORT = false;

export default function DailyReportDownload({ data, date }: { data: any, date: string }) {
  const doc = USE_REAL_REPORT 
    ? <DailyProjectReport data={data} />
    : <MinimalDoc />;

  return (
    <BlobProvider document={doc}>
      {({ url, loading, error }) => {
        if (error) {
          console.error("PDF Blob Error:", error);
          return <span className="text-sm text-red-600 self-center">PDF Error: {error.message}</span>;
        }
        if (loading) {
           return (
              <button disabled className="inline-flex justify-center rounded-md border border-transparent bg-emerald-400 px-4 py-2 text-sm font-medium text-white cursor-wait">
                 Generating PDF...
              </button>
           );
        }
        return (
          <a
            href={url || '#'}
            download={`Daily_Report_${data.project.name.replace(/\s+/g, '_')}_${date}.pdf`}
            className="inline-flex justify-center items-center gap-2 rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Download PDF
          </a>
        );
      }}
    </BlobProvider>
  );
}
