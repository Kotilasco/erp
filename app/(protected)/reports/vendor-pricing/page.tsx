import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PrintHeader from '@/components/PrintHeader';
import VendorPricingClient from './client';

interface Props {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}

export default async function VendorPricingPage(props: Props) {
    const user = await getCurrentUser();
    if (!user) redirect('/login');

    const allowedRoles = ['ADMIN', 'MANAGING_DIRECTOR', 'PROCUREMENT', 'SENIOR_PROCUREMENT', 'PROJECT_OPERATIONS_OFFICER'];
    if (!allowedRoles.includes(user.role as string)) return <div className="p-8">Access Denied</div>;

    const searchParams = typeof props.searchParams === 'object' ? await props.searchParams : props.searchParams || {};
    const selectedItemName = (searchParams?.item || '').toString();

    // 1. Fetch Inventory List for Dropdown
    const inventoryItems = await prisma.inventoryItem.findMany({
        select: { description: true },
        orderBy: { description: 'asc' }
    });
    // Deduplicate descriptions
    const inventoryList = Array.from(new Set(inventoryItems.map(i => i.description))).filter(Boolean);

    let selectedItem = null;

    // 2. If Item Selected, Fetch Analysis Data
    if (selectedItemName) {
        const grnItems = await prisma.goodsReceivedNoteItem.findMany({
            where: {
                description: { equals: selectedItemName }, // Exact match
                priceMinor: { not: null }
            },
            select: {
                id: true,
                description: true,
                unit: true,
                priceMinor: true,
                grn: {
                    select: {
                        vendorName: true,
                        vendorPhone: true,
                        receivedAt: true,
                        updatedAt: true,
                    }
                }
            },
            orderBy: { grn: { receivedAt: 'desc' } }
        });

        // Process Data for Single Item
        const vendors = new Map<string, any>();
        let unit = '';

        for (const item of grnItems) {
            if (!item.grn.vendorName) continue;
            
            // Capture unit from first occurrence
            if (!unit) unit = item.unit || '';

            const vendorName = item.grn.vendorName;
            
            // Latest price logic (orderBy receivedAt desc)
            if (!vendors.has(vendorName)) {
                vendors.set(vendorName, {
                    vendor: vendorName,
                    phone: item.grn.vendorPhone,
                    priceMinor: item.priceMinor,
                    unit: item.unit,
                    lastDate: item.grn.receivedAt || item.grn.updatedAt
                });
            }
        }

        const sortedVendors = Array.from(vendors.values())
            .sort((a, b) => Number(a.priceMinor - b.priceMinor))
            .slice(0, 3); // Top 3

        if (sortedVendors.length > 0) {
            selectedItem = {
                description: selectedItemName,
                unit: unit,
                vendors: sortedVendors.map(v => ({
                    vendor: v.vendor,
                    phone: v.phone,
                    price: Number(v.priceMinor) / 100,
                    lastDate: v.lastDate
                }))
            };
        }
    }

    return (
        <div className="p-6 space-y-8 max-w-[1600px] mx-auto min-h-screen">
             <PrintHeader />
             <div className="border-b border-gray-200 pb-6">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Vendor Pricing Analysis</h1>
                <p className="text-gray-500 mt-2">Select an item from inventory to compare top vendor prices.</p>
             </div>
             
             <VendorPricingClient 
                inventoryList={inventoryList}
                selectedItem={selectedItem}
                initialItem={selectedItemName}
             />
        </div>
    );
}
