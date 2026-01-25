import { prisma } from '@/lib/db';
import { format } from 'date-fns';

export async function fetchCardData() {
    try {
        // Run queries sequentially to spare connection pool in dev
        const quoteCount = await prisma.quote.count();
        const customerCount = await prisma.customer.count();
        const pendingQuoteCount = await prisma.quote.count({
            where: {
                status: {
                    in: ['DRAFT', 'SUBMITTED_REVIEW', 'NEGOTIATION']
                }
            }
        });
        const projectCount = await prisma.project.count();
        const pendingProjectCount = await prisma.project.count({
            where: {
                status: {
                    in: ['CREATED', 'PLANNED', 'DEPOSIT_PENDING', 'SCHEDULING_PENDING']
                }
            }
        });
        const revenueResult = await prisma.payment.aggregate({
            _sum: {
                amountMinor: true
            }
        });

        const totalRevenue = Number(revenueResult._sum.amountMinor || 0) / 100;

        return {
            numberOfQuotes: quoteCount,
            numberOfCustomers: customerCount,
            numberOfPendingQuotes: pendingQuoteCount,
            numberOfProjects: projectCount,
            numberOfPendingProjects: pendingProjectCount,
            totalRevenue,
        };
    } catch (error) {
        console.error('Database Error:', error);
        return {
            numberOfQuotes: 0,
            numberOfCustomers: 0,
            numberOfPendingQuotes: 0,
            numberOfProjects: 0,
            numberOfPendingProjects: 0,
            totalRevenue: 0,
        };
    }
}

export async function fetchRevenueData() {
    try {
        // Fetch payments for the last 6 months
        const payments = await prisma.payment.findMany({
            orderBy: {
                receivedAt: 'asc',
            },
            // You might want to limit this to a date range in a real app
        });

        // Group by month
        const revenueByMonth: Record<string, number> = {};

        payments.forEach((payment) => {
            const month = format(payment.receivedAt, 'MMM');
            const amount = Number(payment.amountMinor) / 100;
            revenueByMonth[month] = (revenueByMonth[month] || 0) + amount;
        });

        // Convert to array format for Recharts
        const data = Object.entries(revenueByMonth).map(([name, revenue]) => ({
            name,
            revenue,
        }));

        // If no data, return some empty months or just empty array
        if (data.length === 0) {
            return [
                { name: 'Jan', revenue: 0 },
                { name: 'Feb', revenue: 0 },
                { name: 'Mar', revenue: 0 },
            ];
        }

        return data;
    } catch (error) {
        console.error('Database Error:', error);
        return [
            { name: 'Jan', revenue: 0 },
            { name: 'Feb', revenue: 0 },
            { name: 'Mar', revenue: 0 },
        ];
    }
}

export async function fetchRecentQuotes() {
    try {
        const quotes = await prisma.quote.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                status: true,
                createdAt: true,
                customer: { select: { displayName: true } },
            },
        });

        const ids = quotes.map(q => q.id);
        const totals: Record<string, number> = {};
        if (ids.length > 0) {
            const sums = await prisma.quoteLine.groupBy({
                by: ['quoteId'],
                where: { quoteId: { in: ids } },
                _sum: { lineTotalMinor: true },
            });
            sums.forEach(s => {
                totals[s.quoteId] = Number(s._sum.lineTotalMinor || 0);
            });
        }

        return quotes.map((quote) => {
            const totalMinor = totals[quote.id] || 0;
            return {
                id: quote.id,
                customer: quote.customer.displayName,
                amount: totalMinor / 100,
                status: quote.status,
                date: format(quote.createdAt, 'yyyy-MM-dd'),
            };
        });
    } catch (error) {
        console.error('Database Error:', error);
        return [];
    }
}
