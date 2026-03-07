import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import * as ordersController from './controllers/orders.controller';
import * as dashboardController from './controllers/dashboard.controller';
import * as settingsController from './controllers/settings.controller';
import * as backupController from './controllers/backup.controller';
import * as brandsController from './controllers/brands.controller';
import * as auditController from './controllers/audit.controller';

const app = express();
const PORT = process.env.PORT || 3020;

app.disable('x-powered-by');
app.set('etag', 'strong');
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/orders/pending-count', ordersController.getPendingCount);
app.get('/api/orders', ordersController.getOrders);
app.post('/api/orders', ordersController.createOrder);
app.put('/api/orders/:id', ordersController.updateOrder);
app.delete('/api/orders/:id', ordersController.deleteOrder);
app.post('/api/orders/:id/duplicate', ordersController.duplicateOrder);
app.post('/api/orders/bulk-update', ordersController.bulkUpdateOrders);
app.post('/api/orders/bulk-delete', ordersController.bulkDeleteOrders);

app.get('/api/dashboard', dashboardController.getDashboard);

app.get('/api/settings', settingsController.getSettings);
app.put('/api/settings', settingsController.updateSettings);

app.get('/api/backup/export', backupController.exportDatabase);
app.post('/api/backup/import', backupController.importDatabase);

app.get('/api/brands', brandsController.getBrands);
app.post('/api/brands', brandsController.createBrand);
app.delete('/api/brands/:id', brandsController.deleteBrand);

app.get('/api/audit/order/:orderId', auditController.getAuditLogsByOrder);
app.get('/api/audit', auditController.getAuditLogs);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
