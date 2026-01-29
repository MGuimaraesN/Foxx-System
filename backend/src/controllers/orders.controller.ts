import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { createOrderSchema, updateOrderSchema } from '../schemas';
import { getBiWeeklyPeriodRange } from '../utils/period.utils';

// Helper para garantir que o período existe
const ensurePeriodExists = async (dateStr: string) => {
  const { start, end } = getBiWeeklyPeriodRange(dateStr);

  let period = await prisma.period.findFirst({
    where: { startDate: start, endDate: end }
  });

  if (!period) {
    period = await prisma.period.create({
      data: { startDate: start, endDate: end, paid: false }
    });
  }
  return period;
};

// Recalcular totais de forma otimizada
const recalculatePeriodTotals = async (periodId: string) => {
  const aggregations = await prisma.serviceOrder.aggregate({
    where: { periodId },
    _sum: { commissionValue: true, serviceValue: true },
    _count: { id: true }
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
    if (!validation.success) return res.status(400).json({ error: validation.error });
    const data = validation.data;

    const entryDateStr = new Date(data.entryDate).toISOString().split('T')[0];
    const period = await ensurePeriodExists(entryDateStr);

    if (period.paid) return res.status(400).json({ error: "Cannot add orders to a paid period." });

    let brandId = data.brandId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(brandId);

    if (isUuid) {
        const brandCheck = await prisma.brand.findUnique({ where: { id: brandId } });
        if (!brandCheck) {
             const normalizedName = brandId.trim();
             const existing = await prisma.brand.findUnique({ where: { name: normalizedName } });
             brandId = existing ? existing.id : (await prisma.brand.create({ data: { name: normalizedName } })).id;
        }
    } else {
        const normalizedName = brandId.trim();
        const brandByName = await prisma.brand.findFirst({ where: { name: normalizedName } });
        brandId = brandByName ? brandByName.id : (await prisma.brand.create({ data: { name: normalizedName } })).id;
    }

    const settings = await prisma.settings.findFirst();
    const percentage = settings?.fixedCommissionPercentage || 10;
    const commissionValue = new Prisma.Decimal((data.serviceValue * Number(percentage)) / 100);

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

    await recalculatePeriodTotals(period.id);
    return res.status(201).json(newOrder);
  } catch (e: any) {
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
    
    if (!existingOrder || !existingOrder.period) return res.status(404).json({ error: "Order or period not found" });
    if (existingOrder.status === 'PAID' || existingOrder.period.paid) {
        return res.status(400).json({ error: "Order cannot be edited" });
    }

    const dataToUpdate: any = { ...updates };
    let newPeriodId = existingOrder.periodId;

    if (updates.entryDate) {
        const dateStr = new Date(updates.entryDate).toISOString().split('T')[0];
        const newPeriod = await ensurePeriodExists(dateStr);
        if (newPeriod.paid) return res.status(400).json({ error: "Cannot move to paid period" });
        newPeriodId = newPeriod.id;
        dataToUpdate.periodId = newPeriodId;
    }

    if (updates.serviceValue !== undefined) {
        const settings = await prisma.settings.findFirst();
        const percentage = settings?.fixedCommissionPercentage || 10;
        dataToUpdate.commissionValue = new Prisma.Decimal((Number(updates.serviceValue) * Number(percentage)) / 100);
    }

    const updatedOrder = await prisma.serviceOrder.update({
        where: { id },
        data: {
            ...dataToUpdate,
            auditLogs: {
                create: { action: 'UPDATED', details: 'Order details updated' }
            }
        }
    });

    await recalculatePeriodTotals(existingOrder.periodId!);
    if (newPeriodId !== existingOrder.periodId) await recalculatePeriodTotals(newPeriodId!);

    return res.json(updatedOrder);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
};

// OTIMIZAÇÃO: Não incluir logs de auditoria na listagem principal
export const getOrders = async (req: Request, res: Response) => {
    const orders = await prisma.serviceOrder.findMany({
        include: { brand: true, period: true },
        orderBy: { entryDate: 'desc' },
        take: 500 // Limite de segurança para performance
    });
    
    const mapped = orders.map((o: any) => ({
        ...o,
        brand: o.brand.name,
        brandId: o.brandId,
        history: [] // Retornar vazio para reduzir tamanho do JSON
    }));
    res.json(mapped);
};

export const deleteOrder = async (req: Request, res: Response): Promise<any> => {
    const id = req.params.id as string;
    try {
        const order = await prisma.serviceOrder.findUnique({ 
            where: { id }, include: { period: true } 
        });
        
        if (!order || !order.period) return res.status(404).json({ error: "Not found" });
        if (order.status === 'PAID' || order.period.paid) return res.status(400).json({ error: "Cannot delete" });

        await prisma.auditLog.deleteMany({ where: { serviceOrderId: id } });
        await prisma.serviceOrder.delete({ where: { id } });
        await recalculatePeriodTotals(order.periodId!);

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}