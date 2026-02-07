// app/(protected)/dispatches/actions.ts
'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function deleteDispatch(dispatchId: string) {
  const me = await getCurrentUser();
  if (!me) throw new Error('Auth required');

  // Allow Admin or Project Operations Officer
  if (me.role !== 'ADMIN' && me.role !== 'PROJECT_OPERATIONS_OFFICER') {
    throw new Error('Permission denied');
  }

  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    select: { status: true }
  });

  if (!dispatch) throw new Error('Dispatch not found');
  if (dispatch.status !== 'DRAFT') throw new Error('Cannot delete dispatch that is not in DRAFT status');

  // Delete dispatch items first to avoid Foreign Key constraint violation
  await prisma.$transaction(async (tx) => {
    await tx.dispatchItem.deleteMany({
      where: { dispatchId }
    });

    await tx.dispatch.delete({
      where: { id: dispatchId }
    });
  });

  revalidatePath('/dispatches');
  redirect('/dispatches');
}

function assertSecurity(role?: string | null) {
  if (role !== 'SECURITY' && role !== 'ADMIN') {
    throw new Error('Only Security or Admin can perform this action');
  }
}

/* export async function markItemHandedOut(itemId: string) {
  const me = await getCurrentUser();
  if (!me) throw new Error('Auth required');
  assertSecurity(me.role);

  // Update dispatch item and decrement inventory if linked
  await prisma.$transaction(async (tx) => {
    const item = await tx.dispatchItem.findUnique({ where: { id: itemId }, select: { id: true, dispatchId: true, qty: true, inventoryItemId: true } });
    if (!item) throw new Error('Dispatch item not found');

    await tx.dispatchItem.update({
      where: { id: itemId },
      data: { handedOutAt: new Date(), handedOutById: me.id ?? null },
    });

    if (item.inventoryItemId) {
      await tx.inventoryItem.update({
        where: { id: item.inventoryItemId },
        data: {
          qty: { decrement: item.qty },
          quantity: { decrement: item.qty },
        },
      });
    }
  });

  // revalidate both list and details in case they’re open
  revalidatePath('/dispatches');
  const d = await prisma.dispatchItem.findUnique({ where: { id: itemId }, select: { dispatchId: true } });
  if (d?.dispatchId) revalidatePath(`/dispatches/${d.dispatchId}`);
  revalidatePath('/inventory');
  return { ok: true };
} */

/* export async function markItemHandedOut(itemId: string) {
  const me = await getCurrentUser();
  if (!me) throw new Error('Authentication required');
  // ensure only security (or admin) can do this:
  assertSecurity(me.role);

  const res = await prisma.$transaction(async (tx) => {
    // 1) load the dispatch item and its dispatch (we need status + projectId)
    const item = await tx.dispatchItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        qty: true,
        inventoryItemId: true,
        purchaseId: true,
        dispatch: { select: { id: true, status: true, projectId: true } },
      },
    });
    if (!item) throw new Error('Dispatch item not found');

    // 2) allowed dispatch statuses for handing out (tweak to fit your workflow)
    const allowed = ['SUBMITTED', 'IN_TRANSIT'];
    if (!item.dispatch || !allowed.includes(item.dispatch.status)) {
      throw new Error(
        `Dispatch is not in a state that allows handing out (status=${item.dispatch?.status ?? 'N/A'})`,
      );
    }

    const qtyToHand = Number(item.qty ?? 0);
    if (!(qtyToHand > 0)) throw new Error('Invalid dispatch quantity');

    // 3) mark the dispatch item as handed out
    await tx.dispatchItem.update({
      where: { id: item.id },
      data: { handedOutAt: new Date(), handedOutById: me.id ?? null },
    });

    // 4) resolve an inventory item id for decrementing
    let inventoryId: string | null = item.inventoryItemId ?? null;

    // prefer explicit linked inventory item; fallback to purchase->inventory
    if (!inventoryId && item.purchaseId) {
      const inv = await tx.inventoryItem.findFirst({
        where: { purchaseId: item.purchaseId },
        select: { id: true },
      });
      inventoryId = inv?.id ?? null;
    }

    // If still missing, decide policy:
    // - throw to prevent handing out items not tracked in inventory (recommended)
    // - OR allow handing out but skip decrement (danger: possible over-allocation)
    if (!inventoryId) {
      throw new Error('Dispatch item is not linked to an inventory record; cannot decrement stock');
    }

    // 5) atomically decrement inventory only if there's enough stock
    // use updateMany to perform an atomic conditional update
    const updated = await tx.inventoryItem.updateMany({
      where: {
        id: inventoryId,
        quantity: { gte: qtyToHand }, // ensure enough stock available
      },
      data: {
        quantity: { decrement: qtyToHand }, // "quantity" field used in your schema
        qty: { decrement: qtyToHand }, // if you store both fields keep both in sync
      },
    });

    if (updated.count === 0) {
      // no rows updated -> insufficient stock (or inventory not found)
      throw new Error('Insufficient stock to hand out the requested quantity');
    }

    // 6) create an audit/inventory transaction (recommended) — skip if model not present
    if ((tx as any).inventoryTransaction && typeof (tx as any).inventoryTransaction.create === 'function') {
      await (tx as any).inventoryTransaction.create({
        data: {
          inventoryItemId: inventoryId,
          changeById: me.id!,
          delta: -qtyToHand,
          reason: 'DISPATCH_HANDOUT',
          metaJson: JSON.stringify({ dispatchItemId: item.id, dispatchId: item.dispatch?.id }),
        },
      });
    }

    return {
      ok: true,
      inventoryId,
      handedQty: qtyToHand,
      dispatchId: item.dispatch?.id ?? null,
      projectId: item.dispatch?.projectId ?? null,
    };
  });

  // revalidate relevant pages (adjust routes to match your app)
  if (res.dispatchId) revalidatePath(`/dispatches/${res.dispatchId}`);
  if (res.projectId) revalidatePath(`/projects/${res.projectId}`);
  revalidatePath('/dispatches');
  revalidatePath('/inventory');

  return res;
} */


/*  export async function markItemHandedOut(itemId: string) {
 const me = await getCurrentUser();
 if (!me) throw new Error('Authentication required');
 assertSecurity(me.role);

 const res = await prisma.$transaction(async (tx) => {
   const item = await tx.dispatchItem.findUnique({
     where: { id: itemId },
     select: {
       id: true,
       qty: true,
       inventoryItemId: true,
       purchaseId: true,
       dispatch: { select: { id: true, status: true, projectId: true } },
     },
   });
   if (!item) throw new Error('Dispatch item not found');

   const allowed = ['SUBMITTED', 'IN_TRANSIT']; // adjust as needed
   if (!item.dispatch || !allowed.includes(item.dispatch.status)) {
     throw new Error(`Dispatch is not in a state that allows handing out (status=${item.dispatch?.status ?? 'N/A'})`);
   }

   const qtyToHand = Number(item.qty ?? 0);
   if (!(qtyToHand > 0)) throw new Error('Invalid dispatch quantity');

   // mark handed out on the item
   await tx.dispatchItem.update({
     where: { id: item.id },
     data: { handedOutAt: new Date(), handedOutById: me.id ?? null },
   });

   // determine inventory item id (explicit link or via purchase)
   let inventoryId: string | null = item.inventoryItemId ?? null;
   if (!inventoryId && item.purchaseId) {
     const inv = await tx.inventoryItem.findFirst({ where: { purchaseId: item.purchaseId }, select: { id: true } });
     inventoryId = inv?.id ?? null;
   }

   if (!inventoryId) {
     throw new Error('Dispatch item is not linked to an inventory record; cannot decrement stock');
   }

   // atomically decrement quantity (ensures not negative)
   const updated = await tx.inventoryItem.updateMany({
     where: {
       id: inventoryId,
       quantity: { gte: qtyToHand },
     },
     data: {
       quantity: { decrement: qtyToHand },
       // keep both qty/quantity fields in sync if you have both
       qty: { decrement: qtyToHand },
     },
   });

   if (updated.count === 0) {
     throw new Error('Insufficient stock to hand out the requested quantity');
   }

   return {
     ok: true,
     inventoryId,
     handedQty: qtyToHand,
     dispatchId: item.dispatch?.id ?? null,
     projectId: item.dispatch?.projectId ?? null,
   };
 });

 // revalidate appropriate pages
 if (res.dispatchId) revalidatePath(`/dispatches/${res.dispatchId}`);
 if (res.projectId) revalidatePath(`/projects/${res.projectId}`);
 revalidatePath('/dispatches');
 revalidatePath('/inventory');

 return res;
} */


export async function markItemHandedOut(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) throw new Error("Missing itemId");

  const me = await getCurrentUser();
  if (!me) throw new Error("Authentication required");

  // role guard
  const role = (me as any).role as string | undefined;
  if (!role || !["SECURITY", "ADMIN"].includes(role)) {
    throw new Error("Only security or admin may mark items handed out");
  }

  // ---- 1) Load dispatch item + minimal relations (outside tx) ----
  const it = await prisma.dispatchItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      qty: true,
      unit: true,
      inventoryItemId: true,
      purchaseId: true,
      handedOutQty: true,
      description: true,
      dispatch: { select: { id: true, status: true, projectId: true } },
    },
  });
  if (!it) throw new Error("Dispatch item not found");

  // status guard
  const allowedStatuses = ["SUBMITTED", "APPROVED", "IN_TRANSIT"] as const;
  const dispatchStatus = it.dispatch?.status ?? null;
  if (!dispatchStatus || !allowedStatuses.includes(dispatchStatus as any)) {
    throw new Error(
      `Dispatch status does not allow handing out (status=${dispatchStatus})`
    );
  }

  const qtyToHand = Number(it.qty ?? 0);
  if (!(qtyToHand > 0)) throw new Error("Invalid dispatch quantity to hand out");

  // ---- 2) Resolve/create inventory item (outside tx to keep tx short) ----
  let inventoryId: string | null = it.inventoryItemId ?? null;

  // by purchaseId
  if (!inventoryId && it.purchaseId) {
    const inv = await prisma.inventoryItem.findFirst({
      where: { purchaseId: it.purchaseId },
      select: { id: true, quantity: true, qty: true },
    });
    if (inv) inventoryId = inv.id;
  }

  // by normalized name + unit
  if (!inventoryId) {
    const normalizedName = (it.description ?? "").trim();
    if (normalizedName) {
      const invByName = await prisma.inventoryItem.findFirst({
        where: { name: normalizedName, unit: it.unit ?? null },
        select: { id: true, quantity: true, qty: true },
      });
      if (invByName) inventoryId = invByName.id;
    }
  }

  // seed by creating an inventory record (if purchase exists)
  if (!inventoryId && it.purchaseId) {
    const purchase = await prisma.purchase.findUnique({
      where: { id: it.purchaseId },
      select: { vendor: true, taxInvoiceNo: true, qty: true, purchasedOn: true },
    });
    if (!purchase) {
      throw new Error("Linked purchase not found to seed inventory item");
    }

    const invName =
      (it.description && it.description.trim()) ||
      `${purchase.vendor ?? "Vendor"} / ${purchase.taxInvoiceNo ?? "invoice"}`;
    const unit = it.unit ?? null;
    const key = `${invName.trim()}|${(unit ?? "").trim()}`.toLowerCase();
    const seedQty = Number(purchase.qty ?? it.qty ?? qtyToHand) || qtyToHand;

    try {
      const created = await prisma.inventoryItem.create({
        data: {
          purchaseId: it.purchaseId,
          name: invName,
          description: invName,
          unit,
          key,
          qty: seedQty,
          quantity: seedQty,
          category: "MATERIAL",
        },
        select: { id: true },
      });
      inventoryId = created.id;
    } catch (err: any) {
      // handle potential unique races
      if (err?.code === "P2002" || /unique|constraint/i.test(String(err?.message || ""))) {
        const found = await prisma.inventoryItem.findFirst({
          where: { OR: [{ purchaseId: it.purchaseId }, { name: invName, unit }, { key }] },
          select: { id: true },
        });
        if (found) {
          await prisma.inventoryItem.update({
            where: { id: found.id },
            data: {
              qty: { increment: seedQty },
              quantity: { increment: seedQty },
              ...(it.purchaseId ? { purchaseId: it.purchaseId } : {}),
            },
          });
          inventoryId = found.id;
        } else {
          const fallback = await prisma.inventoryItem.create({
            data: {
              purchaseId: it.purchaseId,
              name: invName,
              description: invName,
              unit,
              key,
              qty: seedQty,
              quantity: seedQty,
              category: "MATERIAL",
            },
            select: { id: true },
          });
          inventoryId = fallback.id;
        }
      } else {
        throw err;
      }
    }
  }

  if (!inventoryId) {
    throw new Error("Dispatch item is not linked to inventory and cannot be handed out");
  }

  // ---- 3) Short transaction: atomic decrement + update dispatch item ----
  await prisma.$transaction(async (tx) => {
    // Atomic stock decrement guarded by gte
    const updated = await tx.inventoryItem.updateMany({
      where: { id: inventoryId!, quantity: { gte: qtyToHand } },
      data: { quantity: { decrement: qtyToHand }, qty: { decrement: qtyToHand } },
    });
    if (updated.count === 0) {
      throw new Error("Insufficient stock to hand out the requested quantity");
    }

    // Ensure we don't exceed dispatched quantity
    const already = Number(it.handedOutQty ?? 0);
    if (already + qtyToHand > Number(it.qty)) {
      throw new Error("Handed out quantity exceeds dispatched quantity");
    }

    // Mark dispatched item as handed out
    await tx.dispatchItem.update({
      where: { id: it.id },
      data: {
        handedOutAt: new Date(),
        handedOutById: me.id!,
        handedOutQty: { increment: qtyToHand },
      },
    });
  });

  // ---- 4) Best-effort audit record (outside tx to avoid session loss) ----
  try {
    await prisma.inventoryMove.create({
      data: {
        inventoryItemId: inventoryId!,
        changeById: me.id!,
        delta: -qtyToHand,
        reason: "DISPATCH_HANDOUT",
        metaJson: JSON.stringify({ dispatchItemId: it.id, dispatchId: it.dispatch?.id }),
      },
    });
  } catch {
    // swallow audit failure; core mutation already succeeded
  }

  // ---- 5) Revalidate affected pages ----
  if (it.dispatch?.id) revalidatePath(`/dispatches/${it.dispatch.id}`);
  revalidatePath("/dispatches");
  revalidatePath("/inventory");

  // ---- 6) Check if ALL items are handed out, then update dispatch status to DISPATCHED ----
  if (it.dispatch?.id) {
    const allItems = await prisma.dispatchItem.findMany({
      where: { dispatchId: it.dispatch.id },
      select: { qty: true, handedOutQty: true }
    });

    const userIsDone = allItems.every(i => (i.handedOutQty ?? 0) >= i.qty);

    if (userIsDone && it.dispatch.status !== 'DISPATCHED') {
      await prisma.dispatch.update({
        where: { id: it.dispatch.id },
        data: { status: 'DISPATCHED' }
      });
      revalidatePath(`/dispatches/${it.dispatch.id}`);
    }
  }

  return {
    ok: true,
    inventoryId,
    handedQty: qtyToHand,
    dispatchId: it.dispatch?.id ?? null,
  };
}

export async function markItemReceived(itemId: string, receiverName: string) {
  const me = await getCurrentUser();
  if (!me) throw new Error('Auth required');
  // Allow SECURITY or ADMIN to set received as well; adjust if you use “STOCKIST”
  assertSecurity(me.role);

  await prisma.dispatchItem.update({
    where: { id: itemId },
    data: { receivedAt: new Date(), receivedByName: receiverName || null },
  });

  revalidatePath('/dispatches');
  revalidatePath(`/dispatches/${(await prisma.dispatchItem.findUnique({ where: { id: itemId }, select: { dispatchId: true } }))!.dispatchId}`);
  return { ok: true };
}
