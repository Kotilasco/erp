import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import PaymentForms from '../payments/PaymentForms';

export default async function ReceivePaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ amount?: string; type?: string }>;
}) {
  const { projectId } = await params;
  const { amount, type } = await searchParams;

  const me = await getCurrentUser();
  if (!me) redirect('/login');
  
  // Basic auth check - similar to payments page
  if (!['SALES_ACCOUNTS', 'ACCOUNTS', 'ADMIN'].includes(me.role as string)) {
    redirect(`/projects/${projectId}`);
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { quote: { include: { customer: true } } },
  });

  if (!project) return <div className="p-6">Project not found</div>;

  const initialAmount = amount ? Number(amount) : 0;
  const fixedType = (type?.toUpperCase() === 'DEPOSIT' ? 'DEPOSIT' : 'INSTALLMENT') as 'DEPOSIT' | 'INSTALLMENT';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-xl p-6">
          <h1 className="text-xl font-bold mb-6 text-gray-900">Receive Payment</h1>
          <PaymentForms
            projectId={projectId}
            initialAmount={initialAmount}
            fixedType={fixedType}
            customerName={project.quote?.customer?.displayName}
            cancelHref={`/projects?tab=due_today`}
          />
      </div>
    </div>
  );
}
