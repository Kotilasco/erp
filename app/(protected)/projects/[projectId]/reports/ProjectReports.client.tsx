
// Components
import DeliveriesReport from './components/DeliveriesReport';
import MaterialReconciliationReport from './components/MaterialReconciliationReport';
import ProfitabilityReport from './components/ProfitabilityReport';

type Tab = 'DELIVERIES' | 'RECONCILIATION' | 'PROFITABILITY';

export default function ProjectReportsClient({ data }: { data: ReportData }) {
  const [activeTab, setActiveTab] = useState<Tab>('DELIVERIES');

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 px-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('DELIVERIES')}
            className={cn(
              activeTab === 'DELIVERIES'
                ? 'border-barmlo-green text-barmlo-green'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors'
            )}
          >
            Deliveries
          </button>
          
          <button
            onClick={() => setActiveTab('RECONCILIATION')}
            className={cn(
              activeTab === 'RECONCILIATION'
                ? 'border-barmlo-green text-barmlo-green'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors'
            )}
          >
            Material Reconciliation
          </button>

          <button
            onClick={() => setActiveTab('PROFITABILITY')}
            className={cn(
              activeTab === 'PROFITABILITY'
                ? 'border-barmlo-green text-barmlo-green'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors'
            )}
          >
            Profitability
          </button>
        </nav>
      </div>

      <div className="p-6">
        {activeTab === 'DELIVERIES' && <DeliveriesReport data={data} />}
        {activeTab === 'RECONCILIATION' && <MaterialReconciliationReport data={data} />}
        {activeTab === 'PROFITABILITY' && <ProfitabilityReport data={data} />}
      </div>
    </div>
  );
}
