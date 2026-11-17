import { createBrowserRouter } from 'react-router'

import { LoginPage } from '@/app/LoginPage'
import { NotFoundPage } from '@/app/NotFoundPage'
import { RequireAuth } from '@/app/RequireAuth'
import { RouteError } from '@/app/RouteError'
import { AuditPage } from '@/features/audit/AuditPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { DealPage } from '@/features/deals/DealPage'
import { DealsPage } from '@/features/deals/DealsPage'
import { AccuracyPage } from '@/features/metrics/AccuracyPage'
import { FindingPage } from '@/features/queue/FindingPage'
import { QueuePage } from '@/features/queue/QueuePage'
import { PricingPage } from '@/features/analytics/PricingPage'
import { BlastRadiusPage } from '@/features/rules/BlastRadiusPage'
import { RulesPage } from '@/features/rules/RulesPage'
import { SandboxPage } from '@/features/sandbox/SandboxPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { SyntheticPage } from '@/features/synthetic/SyntheticPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        // Errors thrown by a page render inside the shell instead of replacing it.
        errorElement: <RouteError />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'queue', element: <QueuePage /> },
          { path: 'findings/:id', element: <FindingPage /> },
          { path: 'deals', element: <DealsPage /> },
          { path: 'deals/:id', element: <DealPage /> },
          { path: 'rules', element: <RulesPage /> },
          { path: 'rules/:id/blast-radius', element: <BlastRadiusPage /> },
          { path: 'insights/pricing', element: <PricingPage /> },
          { path: 'insights/accuracy', element: <AccuracyPage /> },
          { path: 'tools/synthetic', element: <SyntheticPage /> },
          { path: 'tools/sandbox', element: <SandboxPage /> },
          { path: 'audit', element: <AuditPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
