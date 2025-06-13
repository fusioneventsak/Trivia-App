import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import AppLayout from '../layout/AppLayout';
import { useCustomer } from '../../context/CustomerContext';
import { Home } from 'lucide-react';

interface AuthRouteProps {
  requireAuth?: boolean;
  requireAdmin?: boolean;
  requireCustomer?: string;
  redirectTo?: string;
}

export default function AuthRoute({ 
  requireAuth = true, 
  requireAdmin = false,
  requireCustomer = null,
  redirectTo = '/login' 
}: AuthRouteProps) {
  const { hasAccessToCustomer } = useCustomer();

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}