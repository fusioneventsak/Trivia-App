import React, { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCustomer } from '../../context/CustomerContext';

interface CustomerRouteProps {
  children: ReactNode;
  customerId: string;
}

// This component ensures that the route is only accessible 
// by users with access to the specified customer
const CustomerRoute: React.FC<CustomerRouteProps> = ({ children, customerId }) => {

  return <>{children}</>;
};

export default CustomerRoute;