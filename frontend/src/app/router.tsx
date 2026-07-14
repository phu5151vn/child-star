import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ChildLayout } from '@/layouts/ChildLayout';
import { ParentLayout } from '@/layouts/ParentLayout';
import { PublicRoute, RoleRoute } from '@/layouts/RoleRoute';
import { LoginPage, ProfilesPage } from '@/features/auth/AuthPages';
import { ParentDashboardPage } from '@/features/parent/ParentDashboardPage';
import { ParentTasksPage } from '@/features/parent/ParentTasksPage';
import { TaskFormPage } from '@/features/parent/TaskFormPage';
import { ParentRewardsPage } from '@/features/parent/ParentRewardsPage';
import { RewardFormPage } from '@/features/parent/RewardFormPage';
import { ParentApprovalsPage, ParentRedemptionsPage } from '@/features/parent/ParentApprovalsPage';
import { ParentChildrenPage, ParentChildLedgerPage } from '@/features/parent/ParentChildrenPage';
import {
  ChildHomePage,
  ChildTasksPage,
  ChildTaskDetailPage,
  ChildRewardsPage,
  ChildHistoryPage,
} from '@/features/child/ChildPages';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profiles" element={<ProfilesPage />} />
        </Route>

        <Route element={<RoleRoute role="parent" />}>
          <Route element={<ParentLayout />}>
            <Route path="/parent" element={<ParentDashboardPage />} />
            <Route path="/parent/tasks" element={<ParentTasksPage />} />
            <Route path="/parent/tasks/new" element={<TaskFormPage />} />
            <Route path="/parent/tasks/:id/edit" element={<TaskFormPage />} />
            <Route path="/parent/rewards" element={<ParentRewardsPage />} />
            <Route path="/parent/rewards/new" element={<RewardFormPage />} />
            <Route path="/parent/rewards/:id/edit" element={<RewardFormPage />} />
            <Route path="/parent/approvals" element={<ParentApprovalsPage />} />
            <Route path="/parent/redemptions" element={<ParentRedemptionsPage />} />
            <Route path="/parent/children" element={<ParentChildrenPage />} />
            <Route path="/parent/children/:id" element={<ParentChildLedgerPage />} />
          </Route>
        </Route>

        <Route element={<RoleRoute role="child" />}>
          <Route element={<ChildLayout />}>
            <Route path="/child" element={<ChildHomePage />} />
            <Route path="/child/tasks" element={<ChildTasksPage />} />
            <Route path="/child/tasks/:id" element={<ChildTaskDetailPage />} />
            <Route path="/child/rewards" element={<ChildRewardsPage />} />
            <Route path="/child/history" element={<ChildHistoryPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
