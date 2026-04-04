import { Request, Response } from 'express';
import { prisma } from '../db';
import { endOfUtcDay, startOfUtcDay, toDateOnlyString, toUtcDateOnlyDate } from '../utils/date.utils';

const mapPeriod = (period: any) => ({
  ...period,
  startDate: toDateOnlyString(period.startDate),
  endDate: toDateOnlyString(period.endDate)
});

const findExistingPeriodByDates = async (startDate: string, endDate: string) =>
  prisma.period.findFirst({
    where: {
      startDate: { gte: startOfUtcDay(startDate), lte: endOfUtcDay(startDate) },
      endDate: { gte: startOfUtcDay(endDate), lte: endOfUtcDay(endDate) }
    }
  });

export const getPeriods = async (req: Request, res: Response) => {
  const periods = await prisma.period.findMany({
    orderBy: { startDate: 'desc' }
  });
  res.json(periods.map(mapPeriod));
};

export const payPeriod = async (req: Request, res: Response): Promise<any> => {
  const id = req.params.id as string;
  try {
    const period = await prisma.period.findUnique({ where: { id } });
    if (!period) return res.status(404).json({ error: 'Period not found' });
    if (period.paid) return res.status(400).json({ error: 'Period already paid' });

    const now = new Date();

    await prisma.$transaction(async (tx: any) => {
      await tx.period.update({
        where: { id },
        data: {
          paid: true,
          paidAt: now
        }
      });

      const ordersToUpdate = await tx.serviceOrder.findMany({
        where: { periodId: id, status: { not: 'PAID' } }
      });

      if (ordersToUpdate.length > 0) {
        await tx.serviceOrder.updateMany({
          where: { periodId: id, status: { not: 'PAID' } },
          data: {
            status: 'PAID',
            paidAt: now
          }
        });

        const logs = ordersToUpdate.map((o: any) => ({
          action: 'STATUS_CHANGE',
          details: 'Period closed and paid',
          timestamp: now,
          serviceOrderId: o.id
        }));

        await tx.auditLog.createMany({
          data: logs
        });
      }
    });

    res.json({ success: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};

export const createPeriod = async (req: Request, res: Response): Promise<any> => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ error: 'Dates required' });

    const normalizedStart = toDateOnlyString(startDate);
    const normalizedEnd = toDateOnlyString(endDate);

    if (normalizedStart > normalizedEnd) {
      return res.status(400).json({ error: 'Start date cannot be after end date' });
    }

    const existingPeriod = await findExistingPeriodByDates(normalizedStart, normalizedEnd);
    if (existingPeriod) {
      return res.status(400).json({ error: 'Period already exists' });
    }

    const period = await prisma.period.create({
      data: {
        startDate: toUtcDateOnlyDate(normalizedStart),
        endDate: toUtcDateOnlyDate(normalizedEnd),
        paid: false
      }
    });
    res.json(mapPeriod(period));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const deletePeriod = async (req: Request, res: Response): Promise<any> => {
  const id = req.params.id as string;
  try {
    const period = await prisma.period.findUnique({ where: { id } });
    if (!period) return res.status(404).json({ error: 'Period not found' });

    await prisma.$transaction(async (tx: any) => {
      await tx.serviceOrder.updateMany({
        where: { periodId: id },
        data: {
          periodId: null,
          status: 'PENDING',
          paidAt: null
        }
      });

      await tx.period.delete({ where: { id } });
    });

    res.json({ success: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};

export const updatePeriod = async (req: Request, res: Response): Promise<any> => {
  const id = req.params.id as string;
  try {
    const { startDate, endDate } = req.body;
    const data: any = {};

    const normalizedStart = startDate ? toDateOnlyString(startDate) : undefined;
    const normalizedEnd = endDate ? toDateOnlyString(endDate) : undefined;

    if (normalizedStart) data.startDate = toUtcDateOnlyDate(normalizedStart);
    if (normalizedEnd) data.endDate = toUtcDateOnlyDate(normalizedEnd);

    const period = await prisma.period.update({
      where: { id },
      data
    });
    res.json(mapPeriod(period));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};
