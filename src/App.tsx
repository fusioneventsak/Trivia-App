import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import PlayerEntry from './components/PlayerEntry';
import Game from './components/Game';
import AuthRoute from './components/auth/AuthRoute';
import RoomList from './components/rooms/RoomList';
import RoomForm from './components/rooms/RoomForm';
import RoomDetail from './components/rooms/RoomDetail';
import RoomBrandingSettings from './components/rooms/RoomBrandingSettings';
import AdminPanel from './components/AdminPanel';
import MobileController from './components/host/MobileController';
import Dashboard from './components/Dashboard';
import UserManagement from './components/admin/UserManagement';
import SystemSettings from './components/admin/SystemSettings';
import QuestionBank from './components/templates/QuestionBank';
import SystemAnalytics from './components/analytics/SystemAnalytics';
import RoomAnalytics from './components/analytics/RoomAnalytics';
import ActivationManager from './components/activations/ActivationManager';
import { CustomerProvider } from './context/CustomerContext';
import CustomerRoute from './components/auth/CustomerRoute';
import SegmentRouter from './components/routing/SegmentRouter';
import CustomerManagement from './components/CustomerManagement';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import Results from './components/Results';

function App() {
  return (
    <Router>
      <CustomerProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/join" element={<PlayerEntry />} />
          <Route path="/results/:code" element={<Results />} />
          <Route path="/game/:roomId" element={<Game />} />
          
          {/* Auth Routes */}
          <Route path="/login" element={<LoginForm />} />
          <Route path="/register" element={<RegisterForm />} />
          
          {/* Auth Required Routes */}
          <Route element={<AuthRoute requireAuth={true} />}>
            {/* Make Dashboard the default landing page */}
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/settings" element={<SystemSettings />} />
            <Route path="/admin/analytics" element={<SystemAnalytics />} />
            
            {/* Question Bank */}
            <Route path="/admin/question-bank" element={<QuestionBank />} />
            <Route path="/question-bank" element={<Navigate to="/admin/question-bank" replace />} />
            
            {/* Legacy Routes - redirected to new URL structure */}
            <Route path="/rooms" element={<Navigate to="/admin/rooms" replace />} />
            <Route path="/rooms/create" element={<Navigate to="/admin/rooms/create" replace />} />
            <Route path="/rooms/edit/:id" element={<Navigate to={location => `/admin/rooms/edit/${location.pathname.split('/').pop()}`} replace />} />
            
            {/* Admin Routes - New Structure */}
            <Route path="/admin/rooms" element={<RoomList />} />
            <Route path="/admin/rooms/create" element={<RoomForm />} />
            <Route path="/admin/rooms/edit/:id" element={<RoomForm />} />
            <Route path="/admin/room/:id" element={<RoomDetail />} />
            <Route path="/admin/branding/:id" element={<RoomBrandingSettings />} />
            <Route path="/admin/activations/:roomId" element={<ActivationManager />} />
            <Route path="/admin/analytics/:roomId" element={<RoomAnalytics />} />
            <Route path="/admin/customers" element={<CustomerManagement />} />
          </Route>
          
          {/* Mobile Controller */}
          <Route path="/mobile-control/:roomId/:accessCode" element={<MobileController />} />
          
          {/* Customer Segment Router - This handles the /{customer-id}/* paths */}
          <Route path="/:customerId/*" element={<SegmentRouter />} />
        </Routes>
      </CustomerProvider>
    </Router>
  );
}

export default App;