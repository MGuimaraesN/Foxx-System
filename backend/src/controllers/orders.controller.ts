import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { createOrderSchema, updateOrderSchema, bulkUpdateOrderSchema } from '../schemas';
import { getBiWeeklyPeriodRange } from '../utils/period.utils';
import { endOfUtcDay as endOfDay, startOfUtcDay as startOfDay, toDateOnlyString, toUtcDateOnlyDate } from '../utils/date.utils';

const orderSelect = {
  id: true,
  osNumber: true,
  entryDate: true,
  customerName: true,
  serviceValue: true,
  commissionValue: true,
  status: true,
  paymentMethod: true,
  description: true,
  createdAt: true,
  paidAt: true,
  brandId: true,
  periodId: true,
  brand: {
    select: {
      id: true,
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
} satisfies Prisma.ServiceOrderSelect;

type SelectedOrder = Prisma.ServiceOrderGetPayload<{ select: typeof orderSelect }>;

type OrderStatus = 'PENDING' | 'PAID';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const toNumber = (value: Prisma.Decimal | number | null | undefined) => Number(value || 0);
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const normalizeStatus = (value: unknown): OrderStatus | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.toUpperCase();
  if (normalized === 'PENDING' || normalized === 'PAID') return normalized;
  return null;
};

const mapPeriod = (period: SelectedOrder['period']) =>
  period
    ? {
        ...period,
        startDate: toDateOnlyString(period.startDate),
        endDate: toDateOnlyString(period.endDate)
      }
    : null;

const mapOrder = (order: SelectedOrder) => ({
  id: order.id,
  osNumber: order.osNumber,
  entryDate: toDateOnlyString(order.entryDate),
  customerName: order.customerName,
  brand: order.brand.name,
  brandId: order.brandId,
  serviceValue: toNumber(order.serviceValue),
  commissionValue: toNumber(order.commissionValue),
  status: order.status,
  periodId: order.periodId,
  period: mapPeriod(order.period),
  createdAt: order.createdAt,
  paidAt: order.paidAt,
  paymentMethod: order.paymentMethod,
  description: order.description,
  history: []
});

const buildOrdersWhere = (query: Request['query']): Prisma.ServiceOrderWhereInput => {
  const filters: Prisma.ServiceOrderWhereInput[] = [];

  const status = normalizeStatus(query.status);
  if (status) {
    filters.push({ status });
  }

  const brand = typeof query.brand === 'string' ? query.brand.trim() : '';
  if (brand && brand !== 'ALL') {
    filters.push({ brand: { is: { name: brand } } });
  }

  const startDateValue = typeof query.startDate === 'string' ? query.startDate.trim() : '';
  const endDateValue = typeof query.endDate === 'string' ? query.endDate.trim() : '';
  if (startDateValue || endDateValue) {
    const entryDate: Prisma.DateTimeFilter = {};
    if (startDateValue) entryDate.gte = startOfDay(startDateValue);
    if (endDateValue) entryDate.lte = endOfDay(endDateValue);
    filters.push({ entryDate });
  }

  const q = typeof query.q === 'string' ? query.q.trim() : '';
  if (q) {
    const searchFilters: Prisma.ServiceOrderWhereInput[] = [
      { customerName: { contains: q } },
      { brand: { is: { name: { contains: q } } } }
    ];

    const maybeOsNumber = Number(q);
    if (Number.isInteger(maybeOsNumber)) {
      searchFilters.push({ osNumber: maybeOsNumber });
    }

    filters.push({ OR: searchFilters });
  }

  if (filters.length === 0) {
    return {};
  }

  return { AND: filters };
};

const resolveBrandId = async (brandInput: string) => {
  const normalizedName = brandInput.trim();
  if (!normalizedName) {
    throw new Error('Brand is required');
  }

  if (isUuid(normalizedName)) {
    const brandById = await prisma.brand.findUnique({ where: { id: normalizedName } });
    if (brandById) {
      return brandById.id;
    }
  }

  const brandByName = await prisma.brand.findFirst({ where: { name: normalizedName } });
  if (brandByName) {
    return brandByName.id;
  }

  const brand = await prisma.brand.create({ data: { name: normalizedName } });
  return brand.id;
};

const getCommissionPercentage = async () => {
  const settings = await prisma.settings.findFirst({ select: { fixedCommissionPercentage: true } });
  return Number(settings?.fixedCommissionPercentage || 10);
};

const buildCommissionValue = (serviceValue: number, percentage: number) =>
  new Prisma.Decimal((Number(serviceValue) * Number(percentage)) / 100);

const ensurePeriodExists = async (dateStr: string) => {
  const { start, end } = getBiWeeklyPeriodRange(dateStr);
  const startDateOnly = toDateOnlyString(start);
  const endDateOnly = toDateOnlyString(end);

  let period = await prisma.period.findFirst({
    where: {
      startDate: { gte: startOfDay(startDateOnly), lte: endOfDay(startDateOnly) },
      endDate: { gte: startOfDay(endDateOnly), lte: endOfDay(endDateOnly) }
    }
  });

  if (!period) {
    period = await prisma.period.create({
      data: {
        startDate: toUtcDateOnlyDate(startDateOnly),
        endDate: toUtcDateOnlyDate(endDateOnly),
        paid: false
      }
    });
  }

  return period;
};

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
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.flatten() });
    }

    const data = validation.data;
    const entryDateStr = toDateOnlyString(data.entryDate);
    const period = await ensurePeriodExists(entryDateStr);

    if (period.paid) {
      return res.status(400).json({ error: 'Cannot add orders to a paid period.' });
    }

    const [brandId, percentage] = await Promise.all([
      resolveBrandId(data.brandId),
      getCommissionPercentage()
    ]);

    const newOrder = await prisma.serviceOrder.create({
      data: {
        osNumber: data.osNumber,
        entryDate: toUtcDateOnlyDate(data.entryDate),
        customerName: data.customerName,
        serviceValue: data.serviceValue,
        commissionValue: buildCommissionValue(data.serviceValue, percentage),
        status: 'PENDING',
        paymentMethod: data.paymentMethod,
        description: data.description,
        periodId: period.id,
        brandId,
        auditLogs: {
          create: {
            action: 'CREATED',
            details: `Order created with value ${data.serviceValue}`
          }
        }
      },
      select: orderSelect
    });

    await recalculatePeriodTotals(period.id);
    return res.status(201).json(mapOrder(newOrder));
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(400).json({ error: 'OS Number already exists' });
    }

    return res.status(500).json({ error: e.message });
  }
};

export const updateOrder = async (req: Request, res: Response): Promise<any> => {
  const id = req.params.id as string;

  try {
    const validation = updateOrderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.flatten() });
    }

    const updates = validation.data;
    const existingOrder = await prisma.serviceOrder.findUnique({
      where: { id },
      include: { period: true }
    });

    if (!existingOrder || !existingOrder.period) {
      return res.status(404).json({ error: 'Order or period not found' });
    }

    if (existingOrder.status === 'PAID' || existingOrder.period.paid) {
      return res.status(400).json({ error: 'Order cannot be edited' });
    }

    const dataToUpdate: Prisma.ServiceOrderUpdateInput = {};
    let newPeriodId = existingOrder.periodId;
    let shouldRecalculate = false;
    let auditDetails = 'Order details updated';

    if (updates.brandId) {
      dataToUpdate.brand = { connect: { id: await resolveBrandId(updates.brandId) } };
    }

    if (updates.osNumber !== undefined) {
      dataToUpdate.osNumber = updates.osNumber;
    }

    if (updates.customerName !== undefined) {
      dataToUpdate.customerName = updates.customerName;
    }

    if (updates.paymentMethod !== undefined) {
      dataToUpdate.paymentMethod = updates.paymentMethod;
    }

    if (updates.description !== undefined) {
      dataToUpdate.description = updates.description;
    }

    if (updates.entryDate) {
      const dateStr = toDateOnlyString(updates.entryDate);
      const newPeriod = await ensurePeriodExists(dateStr);
      if (newPeriod.paid) {
        return res.status(400).json({ error: 'Cannot move to paid period' });
      }

      dataToUpdate.entryDate = toUtcDateOnlyDate(updates.entryDate);
      if (newPeriod.id !== existingOrder.periodId) {
        newPeriodId = newPeriod.id;
        dataToUpdate.period = { connect: { id: newPeriod.id } };
        shouldRecalculate = true;
      }
    }

    if (updates.serviceValue !== undefined) {
      const percentage = await getCommissionPercentage();
      dataToUpdate.serviceValue = updates.serviceValue;
      dataToUpdate.commissionValue = buildCommissionValue(Number(updates.serviceValue), percentage);
      shouldRecalculate = true;
    }

    if (updates.status) {
      dataToUpdate.status = updates.status;
      dataToUpdate.paidAt = updates.status === 'PAID' ? new Date() : null;
      auditDetails = `Status updated to ${updates.status}`;
    }

    const updatedOrder = await prisma.serviceOrder.update({
      where: { id },
      data: {
        ...dataToUpdate,
        auditLogs: {
          create: {
            action: 'UPDATED',
            details: auditDetails
          }
        }
      },
      select: orderSelect
    });

    if (shouldRecalculate && existingOrder.periodId) {
      await recalculatePeriodTotals(existingOrder.periodId);
      if (newPeriodId && newPeriodId !== existingOrder.periodId) {
        await recalculatePeriodTotals(newPeriodId);
      }
    }

    return res.json(mapOrder(updatedOrder));
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(400).json({ error: 'OS Number already exists' });
    }

    return res.status(500).json({ error: e.message });
  }
};

export const getOrders = async (req: Request, res: Response) => {
  try {
    const where = buildOrdersWhere(req.query);
    const all = req.query.all === 'true';
    const requestedPage = Number(req.query.page || 1);
    const requestedLimit = Number(req.query.limit || 25);
    const limit = clamp(Number.isFinite(requestedLimit) ? requestedLimit : 25, 1, all ? 5000 : 100);
    const page = all ? 1 : clamp(Number.isFinite(requestedPage) ? requestedPage : 1, 1, 100000);
    const skip = all ? 0 : (page - 1) * limit;

    const [orders, total, summary, statusGroups] = await Promise.all([
      prisma.serviceOrder.findMany({
        where,
        select: orderSelect,
        orderBy: [
          { entryDate: 'desc' },
          { osNumber: 'desc' }
        ],
        skip,
        take: all ? limit : limit
      }),
      prisma.serviceOrder.count({ where }),
      prisma.serviceOrder.aggregate({
        where,
        _sum: {
          serviceValue: true,
          commissionValue: true
        }
      }),
      prisma.serviceOrder.groupBy({
        by: ['status'],
        where,
        _count: { id: true }
      })
    ]);

    const pages = total === 0 ? 1 : Math.ceil(total / limit);
    const pending = statusGroups.find((group) => group.status === 'PENDING')?._count.id || 0;
    const paid = statusGroups.find((group) => group.status === 'PAID')?._count.id || 0;

    res.json({
      data: orders.map(mapOrder),
      pagination: {
        page,
        limit,
        total,
        pages,
        hasNext: !all && page < pages,
        hasPrev: !all && page > 1
      },
      summary: {
        totalOrders: total,
        totalServiceValue: toNumber(summary._sum.serviceValue),
        totalCommission: toNumber(summary._sum.commissionValue),
        statusBreakdown: {
          pending,
          paid
        }
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
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
      where: { id },
      include: { period: true }
    });

    if (!order || !order.period) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (order.status === 'PAID' || order.period.paid) {
      return res.status(400).json({ error: 'Cannot delete' });
    }

    await prisma.auditLog.deleteMany({ where: { serviceOrderId: id } });
    await prisma.serviceOrder.delete({ where: { id } });

    if (order.periodId) {
      await recalculatePeriodTotals(order.periodId);
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const duplicateOrder = async (req: Request, res: Response): Promise<any> => {
  const id = req.params.id as string;

  try {
    const original = await prisma.serviceOrder.findUnique({ where: { id } });
    if (!original) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const maxOs = await prisma.serviceOrder.aggregate({ _max: { osNumber: true } });
    const nextOsNumber = (maxOs._max.osNumber || 1000) + 1;
    const now = new Date();
    const entryDate = toUtcDateOnlyDate(now);
    const period = await ensurePeriodExists(toDateOnlyString(entryDate));

    if (period.paid) {
      return res.status(400).json({ error: 'Current period is paid/closed.' });
    }

    const commissionPercentage = await getCommissionPercentage();
    const newOrder = await prisma.serviceOrder.create({
      data: {
        osNumber: nextOsNumber,
        entryDate,
        customerName: original.customerName,
        serviceValue: original.serviceValue,
        commissionValue: buildCommissionValue(Number(original.serviceValue), commissionPercentage),
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
      },
      select: orderSelect
    });

    await recalculatePeriodTotals(period.id);
    return res.status(201).json(mapOrder(newOrder));
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
};

export const bulkUpdateOrders = async (req: Request, res: Response): Promise<any> => {
  try {
    const validation = bulkUpdateOrderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.flatten() });
    }

    const { ids, status } = validation.data;
    const targetOrders = await prisma.serviceOrder.findMany({
      where: { id: { in: ids } },
      include: { period: true }
    });

    const validIds: string[] = [];
    for (const order of targetOrders) {
      if (order.status === 'PAID') continue;
      if (order.period?.paid) continue;
      validIds.push(order.id);
    }

    if (validIds.length === 0) {
      return res.json({ success: true, message: 'No applicable orders to update' });
    }

    const paidAt = status === 'PAID' ? new Date() : null;
    await prisma.$transaction(
      validIds.flatMap((orderId) => [
        prisma.serviceOrder.update({
          where: { id: orderId },
          data: {
            status,
            paidAt
          }
        }),
        prisma.auditLog.create({
          data: {
            serviceOrderId: orderId,
            action: 'BULK_UPDATE',
            details: `Status updated to ${status} via bulk action`
          }
        })
      ])
    );

    res.json({ success: true, count: validIds.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const bulkDeleteOrders = async (req: Request, res: Response): Promise<any> => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'IDs array required' });
  }

  try {
    const targetOrders = await prisma.serviceOrder.findMany({
      where: { id: { in: ids } },
      include: { period: true }
    });

    const validIds: string[] = [];
    const periodIds = new Set<string>();

    for (const order of targetOrders) {
      if (order.status === 'PAID') continue;
      if (order.period?.paid) continue;

      validIds.push(order.id);
      if (order.periodId) {
        periodIds.add(order.periodId);
      }
    }

    if (validIds.length === 0) {
      return res.json({ success: true, message: 'No applicable orders to delete' });
    }

    await prisma.auditLog.deleteMany({
      where: { serviceOrderId: { in: validIds } }
    });

    await prisma.serviceOrder.deleteMany({
      where: { id: { in: validIds } }
    });

    await Promise.all(Array.from(periodIds).map((periodId) => recalculatePeriodTotals(periodId)));

    res.json({ success: true, count: validIds.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};
