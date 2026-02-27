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

    let brandId = updates.brandId;
    if (brandId) {
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
      updates.brandId = brandId;
    }
    
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

// OTIMIZAÇÃO: Usar select para buscar apenas campos necessários
export const getOrders = async (req: Request, res: Response) => {
    const orders = await prisma.serviceOrder.findMany({
        select: {
            id: true,
            osNumber: true,
            customerName: true,
            serviceValue: true,
            commissionValue: true,
            status: true,
            entryDate: true,
            paymentMethod: true,
            paidAt: true,
            description: true, // Needed for edit form pre-fill
            brandId: true,
            periodId: true,
            brand: {
                select: {
                    name: true
                }
            },
            period: {
                select: {
                    id: true,
                    paid: true,
                    startDate: true,
                    endDate: true
                }
            }
        },
        orderBy: { entryDate: 'desc' },
        take: 500 // Limite de segurança para performance
    });
    
    const mapped = orders.map((o: any) => ({
        ...o,
        brand: o.brand.name,
        // brandId e periodId já estão no objeto raiz do select
        history: [] // Retornar vazio para consistência
    }));
    res.json(mapped);
};

export const getPendingCount = async (req: Request, res: Response) => {
    try {
        const count = await prisma.serviceOrder.count({
            where: { status: 'PENDING' }
        });
        res.json({ count });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
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
};

export const duplicateOrder = async (req: Request, res: Response): Promise<any> => {
    const { id } = req.params;
    try {
        const original = await prisma.serviceOrder.findUnique({ where: { id } });
        if (!original) return res.status(404).json({ error: "Order not found" });

        // Find next OS Number logic: Max OS Number in the system + 1
        const maxOs = await prisma.serviceOrder.aggregate({
            _max: { osNumber: true }
        });

        const nextOsNumber = (maxOs._max.osNumber || 1000) + 1;
        const now = new Date();
        const entryDateStr = now.toISOString().split('T')[0];

        // Ensure period exists for today
        const period = await ensurePeriodExists(entryDateStr);
        if (period.paid) return res.status(400).json({ error: "Current period is paid/closed." });

        const newOrder = await prisma.serviceOrder.create({
            data: {
                osNumber: nextOsNumber,
                entryDate: now,
                customerName: original.customerName,
                serviceValue: original.serviceValue,
                commissionValue: original.commissionValue,
                status: 'PENDING',
                paymentMethod: original.paymentMethod,
                description: original.description,
                brandId: original.brandId,
                periodId: period.id,
                auditLogs: {
                    create: {
                        action: 'DUPLICATED',
                        details: `Duplicated from order #${original.osNumber}`
                    }
                }
            }
        });

        await recalculatePeriodTotals(period.id);
        return res.status(201).json(newOrder);
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
};

export const bulkUpdateOrders = async (req: Request, res: Response): Promise<any> => {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "IDs array required" });

    try {
        // CORREÇÃO: Respeitar validações do update individual
        // 1. Buscar todas as ordens alvo
        const targetOrders = await prisma.serviceOrder.findMany({
            where: { id: { in: ids } },
            include: { period: true }
        });

        const validIds: string[] = [];
        const periodIds = new Set<string>();

        // 2. Filtrar apenas as válidas (não PAGO, período não pago)
        for (const order of targetOrders) {
            if (order.status === 'PAID') continue; // Já pago, não muda
            if (order.period?.paid) continue; // Período pago, bloqueado

            validIds.push(order.id);
            if (order.periodId) periodIds.add(order.periodId);
        }

        if (validIds.length === 0) {
            return res.json({ success: true, message: "No applicable orders to update" });
        }

        // 3. Executar updates em transação para garantir audit logs
        await prisma.$transaction(
            validIds.flatMap(id => [
                prisma.serviceOrder.update({
                    where: { id },
                    data: { status }
                }),
                prisma.auditLog.create({
                    data: {
                        serviceOrderId: id,
                        action: 'BULK_UPDATE',
                        details: `Status updated to ${status} via bulk action`
                    }
                })
            ])
        );

        // 4. Recalcular períodos afetados
        await Promise.all(Array.from(periodIds).map(pid => recalculatePeriodTotals(pid)));

        res.json({ success: true, count: validIds.length });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const bulkDeleteOrders = async (req: Request, res: Response): Promise<any> => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "IDs array required" });

    try {
        // CORREÇÃO: Respeitar validações do delete individual
        const targetOrders = await prisma.serviceOrder.findMany({
            where: { id: { in: ids } },
            include: { period: true }
        });

        const validIds: string[] = [];
        const periodIds = new Set<string>();

        for (const order of targetOrders) {
            if (order.status === 'PAID') continue; // Pago não pode deletar
            if (order.period?.paid) continue; // Período pago não pode deletar

            validIds.push(order.id);
            if (order.periodId) periodIds.add(order.periodId);
        }

        if (validIds.length === 0) {
            return res.json({ success: true, message: "No applicable orders to delete" });
        }

        // Delete audit logs first due to FK constraints
        await prisma.auditLog.deleteMany({
            where: { serviceOrderId: { in: validIds } }
        });

        await prisma.serviceOrder.deleteMany({
            where: { id: { in: validIds } }
        });

        await Promise.all(Array.from(periodIds).map(pid => recalculatePeriodTotals(pid)));

        res.json({ success: true, count: validIds.length });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};
