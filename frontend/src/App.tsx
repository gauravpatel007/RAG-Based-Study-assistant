import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthContext';
import ProtectedRoute from '@/routes/ProtectedRoute';
import AppShell from '@/components/layout/AppShell';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import StudyHomePage from '@/pages/StudyHomePage';
import ChatsListPage from '@/pages/ChatsListPage';
import ChatViewPage from '@/pages/ChatViewPage';
import DocumentsPage from '@/pages/DocumentsPage';
import TopicsPage from '@/pages/TopicsPage';
import QuizPage from '@/pages/QuizPage';
import ComparePage from '@/pages/ComparePage';
import FlashcardsPage from '@/pages/FlashcardsPage';
import MindMapsPage from '@/pages/MindMapsPage';
import { PdfViewerPage } from '@/pages/PdfViewerPage';
import { NotesPage } from '@/pages/NotesPage';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminUsers from '@/pages/AdminUsers';
import AdminDocuments from '@/pages/AdminDocuments';
import AdminAiUsage from '@/pages/AdminAiUsage';
import AdminModels from '@/pages/AdminModels';
import AdminAudit from '@/pages/AdminAudit';
import AdminRagAnalytics from '@/pages/AdminRagAnalytics';
import AdminStorage from '@/pages/AdminStorage';
import ApiNotice from '@/components/ApiNotice';
import { ThemeProvider } from '@/features/theme/ThemeProvider';
import { ProfileLayout } from '@/pages/profile/ProfileLayout';
import { PersonalSettings } from '@/pages/profile/PersonalSettings';
import { ThemeSettings } from '@/pages/profile/ThemeSettings';
import { SecuritySettings } from '@/pages/profile/SecuritySettings';
import { AiPreferencesSettings } from '@/pages/profile/AiPreferencesSettings';
import { StorageSettings } from '@/pages/profile/StorageSettings';
import { useAuth } from '@/features/auth/AuthContext';

function AppWithTheme() {
  const { user } = useAuth();
  return (
    <ThemeProvider userId={user?.id}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<Navigate to="/login" replace />} />

          {/* Protected routes with sidebar shell */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/app" element={<StudyHomePage />} />
              <Route path="/app/chats" element={<ChatsListPage />} />
              <Route path="/app/chats/:chatId" element={<ChatViewPage />}>
                <Route path="topics" element={<TopicsPage />} />
                <Route path="mind-maps" element={<MindMapsPage />} />
                <Route path="quiz" element={<QuizPage />} />
                <Route path="compare" element={<ComparePage />} />
                <Route path="flashcards" element={<FlashcardsPage />} />
                <Route path="notes" element={<NotesPage />} />
              </Route>
              <Route path="/app/chats/:chatId/pdf/:documentId" element={<PdfViewerPage />} />
              <Route path="/app/documents" element={<DocumentsPage />} />

              {/* Profile section */}
              <Route path="/app/profile" element={<ProfileLayout />}>
                <Route index element={<PersonalSettings />} />
                <Route path="theme" element={<ThemeSettings />} />
                <Route path="ai" element={<AiPreferencesSettings />} />
                <Route path="security" element={<SecuritySettings />} />
                <Route path="storage" element={<StorageSettings />} />
              </Route>

              {/* Admin section */}
              <Route path="/app/admin" element={<AdminDashboard />} />
              <Route path="/app/admin/users" element={<AdminUsers />} />
              <Route path="/app/admin/documents" element={<AdminDocuments />} />
              <Route path="/app/admin/storage" element={<AdminStorage />} />
              <Route path="/app/admin/ai-usage" element={<AdminAiUsage />} />
              <Route path="/app/admin/rag-analytics" element={<AdminRagAnalytics />} />
              <Route path="/app/admin/models" element={<AdminModels />} />
              <Route path="/app/admin/audit" element={<AdminAudit />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ApiNotice />
      <AppWithTheme />
    </AuthProvider>
  );
}
