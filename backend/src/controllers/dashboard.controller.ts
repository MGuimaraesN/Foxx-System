import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';

const toNumber = (value: Prisma.Decimal | number | bigint | string | null | undefined) => Number(value || 0);
const toDateKey = (date: Date) => date.toISOString().split('T')[0];
const startOfDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const addDays = (date: Date, days: number) => {
  const clone = new Date(date);
  clone.setUTCDate(clone.getUTCDate() + days);
  return clone;
};

type DailyRow = {
  day: string;
  totalServiceValue: number | string | bigint | null;
};

export const getDashboard = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startToday = startOfDay(now);
    const startTomorrow = addDays(startToday, 1);
    const startYesterday = addDays(startToday, -1);

    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();
    const startOfCurrentMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
    const startOfNextMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 1));
    const startOfPrevMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    const startOfLast7Days = addDays(startToday, -6);

    const [
      currentMonthGroups,
      previousMonthStats,
      totalStats,
      todayStats,
      yesterdayStats,
      statusGroups,
      brandRankings,
      customerRankings,
      last7DaysRows,
      bestDayRows
    ] = await Promise.all([
      prisma.serviceOrder.groupBy({
        by: ['status'],
        where: {
          entryDate: { gte: startOfCurrentMonth, lt: startOfNextMonth }
        },
        _sum: { serviceValue: true },
        _count: { id: true }
      }),
      prisma.serviceOrder.aggregate({
        where: { entryDate: { gte: startOfPrevMonth, lt: startOfCurrentMonth } },
        _sum: { serviceValue: true }
      }),
      prisma.serviceOrder.aggregate({
        _sum: { serviceValue: true },
        _count: { id: true }
      }),
      prisma.serviceOrder.aggregate({
        where: { entryDate: { gte: startToday, lt: startTomorrow } },
        _sum: { serviceValue: true },
        _count: { id: true }
      }),
      prisma.serviceOrder.aggregate({
        where: { entryDate: { gte: startYesterday, lt: startToday } },
        _sum: { serviceValue: true },
        _count: { id: true }
      }),
      prisma.serviceOrder.groupBy({
        by: ['status'],
        _count: { id: true }
      }),
      prisma.serviceOrder.groupBy({
        by: ['brandId'],
        _sum: { serviceValue: true },
        orderBy: { _sum: { serviceValue: 'desc' } },
        take: 5
      }),
      prisma.serviceOrder.groupBy({
        by: ['customerName'],
        _sum: { serviceValue: true },
        orderBy: { _sum: { serviceValue: 'desc' } },
        take: 5
      }),
      prisma.$queryRaw<DailyRow[]>(Prisma.sql`
        SELECT date("entryDate") AS day, SUM("serviceValue") AS totalServiceValue
        FROM "ServiceOrder"
        WHERE "entryDate" >= ${startOfLast7Days}
        GROUP BY date("entryDate")
        ORDER BY day ASC
      `),
      prisma.$queryRaw<DailyRow[]>(Prisma.sql`
        SELECT date("entryDate") AS day, SUM("serviceValue") AS totalServiceValue
        FROM "ServiceOrder"
        GROUP BY date("entryDate")
        ORDER BY totalServiceValue DESC
        LIMIT 1
      `)
    ]);

    const brandNames = await prisma.brand.findMany({
      where: { id: { in: brandRankings.map((item) => item.brandId) } },
      select: { id: true, name: true }
    });

    const currentPending = toNumber(currentMonthGroups.find((group) => group.status === 'PENDING')?._sum.serviceValue);
    const currentPaid = toNumber(currentMonthGroups.find((group) => group.status === 'PAID')?._sum.serviceValue);
    const currentTotal = currentPending + currentPaid;
    const prevTotal = toNumber(previousMonthStats._sum.serviceValue);
    const growth = prevTotal === 0 ? (currentTotal > 0 ? 100 : 0) : ((currentTotal - prevTotal) / prevTotal) * 100;

    const totalServiceValue = toNumber(totalStats._sum.serviceValue);
    const todayService = toNumber(todayStats._sum.serviceValue);
    const yesterdayService = toNumber(yesterdayStats._sum.serviceValue);
    const pulseGrowth = yesterdayService === 0 ? (todayService > 0 ? 100 : 0) : ((todayService - yesterdayService) / yesterdayService) * 100;

    const pendingCount = statusGroups.find((group) => group.status === 'PENDING')?._count.id || 0;
    const paidCount = statusGroups.find((group) => group.status === 'PAID')?._count.id || 0;

    const last7DaysMap = new Map(last7DaysRows.map((row) => [row.day, toNumber(row.totalServiceValue)]));
    const last7Days = Array.from({ length: 7 }, (_, index) => {
      const day = addDays(startOfLast7Days, index);
      const dateStr = toDateKey(day);
      return {
        dateStr,
        serviceValue: last7DaysMap.get(dateStr) || 0
      };
    });

    const bestDay = bestDayRows[0];

    res.json({
      monthlyStats: {
        currentMonth: {
          total: currentTotal,
          paid: currentPaid,
          pending: currentPending
        },
        prevMonth: {
          total: prevTotal
        },
        growth
      },
      cards: {
        totalServiceValue,
        totalOrders: totalStats._count.id,
        todayService,
        todayOrdersCount: todayStats._count.id,
        pulseGrowth,
        bestDayValue: bestDay ? toNumber(bestDay.totalServiceValue) : 0,
        bestDayDate: bestDay?.day || ''
      },
      rankings: {
        topBrands: brandRankings.map((ranking) => ({
          name: brandNames.find((brand) => brand.id === ranking.brandId)?.name || 'Unknown',
          value: toNumber(ranking._sum.serviceValue)
        })),
        topCustomers: customerRankings.map((ranking) => ({
          name: ranking.customerName,
          value: toNumber(ranking._sum.serviceValue)
        }))
      },
      charts: {
        last7Days,
        orderStatus: {
          pending: pendingCount,
          paid: paidCount
        }
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};
