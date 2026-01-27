import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { createOrderSchema, updateOrderSchema } from '../schemas';
import { getBiWeeklyPeriodRange } from '../utils/period.utils';

// Helper to ensure period exists
const ensurePeriodExists = async (dateStr: string) => {
  const { start, end } = getBiWeeklyPeriodRange(dateStr);

  // Try to find
  let period = await prisma.period.findFirst({
    where: {
      startDate: start,
      endDate: end
    }
  });

  if (!period) {
    period = await prisma.period.create({
      data: {
        startDate: start,
        endDate: end,
        paid: false
      }
    });
  }
  return period;
};

// Helper to recalculate period totals
const recalculatePeriodTotals = async (periodId: string) => {
  const aggregations = await prisma.serviceOrder.aggregate({
    where: { periodId },
    _sum: {
      commissionValue: true,
      serviceValue: true,
    },
    _count: {
      id: true
    }
  });

  await prisma.period.update({
    where: { id: periodId },
    data: {
      totalOrders: aggregations._count.id,
      totalCommission: aggregations._sum.commissionValue || 0,
      totalServiceValue: aggregations._sum.serviceValue || 0
    }
  });
};

export const createOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const validation = createOrderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }
    const data = validation.data;

    // 1. Period Logic
    const entryDateStr = new Date(data.entryDate).toISOString().split('T')[0];
    const period = await ensurePeriodExists(entryDateStr);

    if (period.paid) {
      return res.status(400).json({ error: "Cannot add orders to a paid period." });
    }

    // 2. Resolve Brand (Name or ID)
    let brandId = data.brandId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(brandId);

    if (isUuid) {
        // Check if it's a valid existing ID
        const brandCheck = await prisma.brand.findUnique({ where: { id: brandId } });
        if (!brandCheck) {
             // Fallback: treat as name if strict UUID lookup fails (rare edge case)
             const normalizedName = brandId.trim();
             const existing = await prisma.brand.findUnique({ where: { name: normalizedName } });
             if (existing) {
                 brandId = existing.id;
             } else {
                 const newBrand = await prisma.brand.create({ data: { name: normalizedName } });
                 brandId = newBrand.id;
             }
        }
    } else {
        // Not a UUID, treat as Name
        const normalizedName = brandId.trim();
        const brandByName = await prisma.brand.findFirst({
            where: { name: normalizedName }
        });

        if (brandByName) {
            brandId = brandByName.id;
        } else {
            // Create if missing
            const newBrand = await prisma.brand.create({ data: { name: normalizedName } });
            brandId = newBrand.id;
        }
    }

    // 3. Commission Logic
    const settings = await prisma.settings.findFirst();
    const percentage = settings?.fixedCommissionPercentage || 10;
    const commissionValue = new Prisma.Decimal((data.serviceValue * Number(percentage)) / 100);

    // 4. Create Order
    const newOrder = await prisma.serviceOrder.create({
      data: {
        osNumber: data.osNumber,
        entryDate: new Date(data.entryDate),
        customerName: data.customerName,
        serviceValue: data.serviceValue,
        commissionValue,
        status: 'PENDING',
        paymentMethod: data.paymentMethod,
        description: data.description,
        periodId: period.id,
        brandId: brandId,
        auditLogs: {
            create: {
                action: 'CREATED',
                details: `Order created with value ${data.serviceValue}`,
            }
        }
      }
    });

    // 5. Update Totals
    await recalculatePeriodTotals(period.id);

    return res.status(201).json(newOrder);

  } catch (e: any) {
    console.error(e);
    if (e.code === 'P2002') return res.status(400).json({ error: "OS Number already exists" });
    return res.status(500).json({ error: e.message });
  }
};

export const updateOrder = async (req: Request, res: Response): Promise<any> => {
  const id = req.params.id as string;
  try {
    const validation = updateOrderSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: validation.error });
    const updates = validation.data;

    const existingOrder = await prisma.serviceOrder.findUnique({
        where: { id },
        include: { period: true }
    });
    
    if (!existingOrder) return res.status(404).json({ error: "Order not found" });

    // Correção TS18047: Garantir que period existe
    if (!existingOrder.period) {
        return res.status(500).json({ error: "Order has no associated period" });
    }

    if (existingOrder.status === 'PAID') {
        return res.status(400).json({ error: "Cannot edit a PAID order" });
    }
    if (existingOrder.period.paid) {
        return res.status(400).json({ error: "Cannot edit orders in a paid period" });
    }

    const dataToUpdate: any = { ...updates };
    let newPeriodId = existingOrder.periodId;

    if (updates.entryDate) {
        const dateStr = new Date(updates.entryDate).toISOString().split('T')[0];
        const newPeriod = await ensurePeriodExists(dateStr);
        if (newPeriod.paid) {
            return res.status(400).json({ error: "Cannot move order to a paid period" });
        }
        newPeriodId = newPeriod.id;
        dataToUpdate.periodId = newPeriodId;
    }

    if (updates.serviceValue !== undefined) {
        const settings = await prisma.settings.findFirst();
        const percentage = settings?.fixedCommissionPercentage || 10;
        dataToUpdate.commissionValue = new Prisma.Decimal((Number(updates.serviceValue) * Number(percentage)) / 100);
    }

    if (updates.status === 'PAID' && existingOrder.status !== 'PAID') {
        dataToUpdate.paidAt = new Date();
    } else if (updates.status === 'PENDING') {
        dataToUpdate.paidAt = null;
    }

    if (updates.brandId) {
       let bId = updates.brandId;
       const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bId);

       if (isUuid) {
           const bCheck = await prisma.brand.findUnique({ where: { id: bId } });
           if (!bCheck) {
               const normalized = bId.trim();
               const existing = await prisma.brand.findFirst({ where: { name: normalized } });
               if (existing) bId = existing.id;
               else {
                   const newB = await prisma.brand.create({ data: { name: normalized } });
                   bId = newB.id;
               }
           }
       } else {
           const normalized = bId.trim();
           const bName = await prisma.brand.findFirst({ where: { name: normalized } });
           if (bName) bId = bName.id;
           else {
               const newB = await prisma.brand.create({ data: { name: normalized } });
               bId = newB.id;
           }
       }
       dataToUpdate.brandId = bId;
    }

    const changes: string[] = [];
    if (updates.serviceValue) changes.push(`Value: ${existingOrder.serviceValue} -> ${updates.serviceValue}`);
    if (updates.status) changes.push(`Status: ${existingOrder.status} -> ${updates.status}`);

    const updatedOrder = await prisma.serviceOrder.update({
        where: { id },
        data: {
            ...dataToUpdate,
            auditLogs: {
                create: {
                    action: 'UPDATED',
                    details: changes.join(', ') || 'Updated details'
                }
            }
        }
    });

    // Correção TS2345: Usar non-null assertion (!) ou garantir que o ID é string
    // Como periodId é obrigatório no schema, usamos ! para informar ao TS que não será null
    await recalculatePeriodTotals(existingOrder.periodId!);
    if (newPeriodId !== existingOrder.periodId) {
        await recalculatePeriodTotals(newPeriodId!);
    }

    return res.json(updatedOrder);

  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};

export const getOrders = async (req: Request, res: Response) => {
    const orders = await prisma.serviceOrder.findMany({
        include: { brand: true, period: true, auditLogs: true },
        orderBy: { createdAt: 'desc' }
    });
    const mapped = orders.map((o: any) => ({
        ...o,
        brand: o.brand.name,
        brandId: o.brandId,
        history: o.auditLogs 
    }));
    res.json(mapped);
};

export const deleteOrder = async (req: Request, res: Response): Promise<any> => {
    const id = req.params.id as string;
    try {
        const order = await prisma.serviceOrder.findUnique({ 
            where: { id }, 
            include: { period: true } 
        });
        
        if (!order) return res.status(404).json({ error: "Not found" });

        // Correção TS18047: Verificar se period existe
        if (!order.period) {
            return res.status(500).json({ error: "Order has no associated period" });
        }

        if (order.status === 'PAID') return res.status(400).json({ error: "Cannot delete PAID order" });
        if (order.period.paid) return res.status(400).json({ error: "Cannot delete from PAID period" });

        await prisma.auditLog.deleteMany({ where: { serviceOrderId: id } });
        await prisma.serviceOrder.delete({ where: { id } });
        
        // Correção TS2345: Garantir que periodId não é null
        await recalculatePeriodTotals(order.periodId!);

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}