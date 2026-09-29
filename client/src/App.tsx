import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { Dashboard } from './pages/Dashboard';
import { IncidentDetail } from './pages/IncidentDetail';
import { LoadingRows } from './components/Common';

const Incidents = lazy(() => import('./pages/Incidents').then((module) => ({ default: module.Incidents })));
const MemoryExplorer = lazy(() => import('./pages/Explore').then((module) => ({ default: module.MemoryExplorer })));
const ServicesPage = lazy(() => import('./pages/Explore').then((module) => ({ default: module.ServicesPage })));
const RunbooksPage = lazy(() => import('./pages/Explore').then((module) => ({ default: module.RunbooksPage })));
const AnalyticsPage = lazy(() => import('./pages/Explore').then((module) => ({ default: module.AnalyticsPage })));
const SettingsPage = lazy(() => import('./pages/Explore').then((module) => ({ default: module.SettingsPage })));

export default function App() {
  return <ToastProvider><BrowserRouter><Routes><Route element={<Layout />}><Route index element={<Dashboard />} /><Route path="incidents" element={<Suspense fallback={<LoadingRows count={7} />}><Incidents /></Suspense>} /><Route path="incidents/:id" element={<IncidentDetail />} /><Route path="memory" element={<Suspense fallback={<LoadingRows count={7} />}><MemoryExplorer /></Suspense>} /><Route path="services" element={<Suspense fallback={<LoadingRows count={7} />}><ServicesPage /></Suspense>} /><Route path="runbooks" element={<Suspense fallback={<LoadingRows count={7} />}><RunbooksPage /></Suspense>} /><Route path="analytics" element={<Suspense fallback={<LoadingRows count={7} />}><AnalyticsPage /></Suspense>} /><Route path="settings" element={<Suspense fallback={<LoadingRows count={5} />}><SettingsPage /></Suspense>} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes></BrowserRouter></ToastProvider>;
}