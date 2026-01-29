import { Request, Response } from 'express';
import { prisma } from '../db';

export const getDashboard = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
    const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1);
    const startOfPrevMonth = new Date(currentYear, currentMonth - 1, 1);

    // OTIMIZAÇÃO: Uma única consulta agrupada por status para o mês atual
    const monthlyGroups = await prisma.serviceOrder.groupBy({
      by: ['status'],
      where: {
        entryDate: { gte: startOfCurrentMonth, lt: startOfNextMonth }
      },
      _sum: { commissionValue: true }
    });

    const currentPaid = Number(monthlyGroups.find(g => g.status === 'PAID')?._sum.commissionValue || 0);
    const currentPending = Number(monthlyGroups.find(g => g.status === 'PENDING')?._sum.commissionValue || 0);
    const currentTotal = currentPaid + currentPending;

    // Estatísticas mês anterior
    const prevStats = await prisma.serviceOrder.aggregate({
      where: { entryDate: { gte: startOfPrevMonth, lt: startOfCurrentMonth } },
      _sum: { commissionValue: true }
    });
    const prevTotal = Number(prevStats._sum.commissionValue || 0);

    const growth = prevTotal === 0 ? 100 : ((currentTotal - prevTotal) / prevTotal) * 100;

    // Rankings (Top 5 Marcas)
    const brandRankings = await prisma.serviceOrder.groupBy({
      by: ['brandId'],
      _sum: { commissionValue: true },
      orderBy: { _sum: { commissionValue: 'desc' } },
      take: 5
    });

    const brands = await prisma.brand.findMany({
        where: { id: { in: brandRankings.map(b => b.brandId) } }
    });

    const topBrands = brandRankings.map((r: any) => ({
        name: brands.find(b => b.id === r.brandId)?.name || 'Unknown',
        value: Number(r._sum.commissionValue || 0)
    }));

    // Rankings (Top 5 Clientes)
    const customerRankings = await prisma.serviceOrder.groupBy({
        by: ['customerName'],
        _sum: { serviceValue: true },
        orderBy: { _sum: { serviceValue: 'desc' } },
        take: 5
    });

    res.json({
        monthlyStats: {
            currentMonth: { total: currentTotal, paid: currentPaid, pending: currentPending },
            prevMonth: { total: prevTotal },
            growth
        },
        rankings: {
            topBrands,
            topCustomers: customerRankings.map(r => ({ name: r.customerName, value: Number(r._sum.serviceValue || 0) }))
        }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};