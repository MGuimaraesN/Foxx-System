import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
// Lazy load pages that might be heavy or not always visited
const ServiceOrders = React.lazy(() => import('./pages/ServiceOrders').then(module => ({ default: module.ServiceOrders })));
const Brands = React.lazy(() => import('./pages/Brands').then(module => ({ default: module.Brands })));
const Reports = React.lazy(() => import('./pages/Reports').then(module => ({ default: module.Reports })));
const Settings = React.lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const Audit = React.lazy(() => import('./pages/Audit').then(module => ({ default: module.Audit })));

import { ErrorBoundary } from './components/ErrorBoundary';

const Loading = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
  </div>
);

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />

            <Route path="/orders" element={
              <Suspense fallback={<Loading />}>
                <ServiceOrders />
              </Suspense>
            } />

            <Route path="/brands" element={
               <Suspense fallback={<Loading />}>
                 <Brands />
               </Suspense>
            } />

            <Route path="/reports" element={
               <Suspense fallback={<Loading />}>
                 <Reports />
               </Suspense>
            } />

            <Route path="/settings" element={
               <Suspense fallback={<Loading />}>
                 <Settings />
               </Suspense>
            } />

            <Route path="/audit" element={
               <Suspense fallback={<Loading />}>
                 <Audit />
               </Suspense>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;