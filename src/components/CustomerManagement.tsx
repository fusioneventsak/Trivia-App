import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CustomerService } from '../lib/customer-service';
import { Users, Briefcase, Plus, Edit, Trash, Search, Filter, Key, Shield, RefreshCw } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  ownerId?: string;
  settings?: Record<string, any>;
  isActive: boolean;
  userCount?: number;
  roomCount?: number;
}

interface User {
  id: string;
  email: string;
  displayName?: string;
}

export default function CustomerManagement() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [customerDetails, setCustomerDetails] = useState<{ userAccess: User[] }>({ userAccess: [] });
  
  // Form state for creating a new customer
  const [newCustomerForm, setNewCustomerForm] = useState({
    id: '',
    name: ''
  });
  
  // Load customers on component mount
  useEffect(() => {
    fetchCustomers();
    fetchUsers();
  }, []);
  
  // Fetch all customers the current user has access to
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const customerData = await CustomerService.getAccessibleCustomers();
      
      // Get additional stats for each customer
      const customersWithStats = await Promise.all(
        customerData.map(async (customer) => {
          // Get user count
          const { count: userCount } = await supabase
            .from('customer_access')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customer.id);
            
          // Get room count
          const { count: roomCount } = await supabase
            .from('customer_rooms')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customer.id);
            
          return {
            ...customer,
            userCount: userCount || 0,
            roomCount: roomCount || 0
          };
        })
      );
      
      setCustomers(customersWithStats);
    } catch (err: any) {
      console.error('Error fetching customers:', err);
      setError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch all users for access management
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, display_name')
        .order('email');
        
      if (error) throw error;
      
      setUsers(data.map(user => ({
        id: user.id,
        email: user.email,
        displayName: user.display_name
      })));
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };
  
  // Handle creating a new customer
  const handleCreateCustomer = async () => {
    try {
      setLoading(true);
      
      // Validate inputs
      if (!newCustomerForm.id.trim() || !newCustomerForm.name.trim()) {
        setError('ID and name are required');
        setLoading(false);
        return;
      }
      
      // Create customer
      const result = await CustomerService.createCustomer({
        id: newCustomerForm.id.toLowerCase(),
        name: newCustomerForm.name
      });
      
      if (!result) {
        throw new Error('Failed to create customer');
      }
      
      // Reset form and refresh customers
      setNewCustomerForm({ id: '', name: '' });
      setShowCreateModal(false);
      await fetchCustomers();
      
    } catch (err: any) {
      console.error('Error creating customer:', err);
      setError(err.message || 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  };
  
  // Open the access management modal for a customer
  const openAccessModal = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowAccessModal(true);
    
    try {
      // Fetch users with access to this customer
      const { data, error } = await supabase
        .from('customer_access')
        .select(`
          user_id,
          access_level,
          users (id, email, display_name)
        `)
        .eq('customer_id', customer.id);
        
      if (error) throw error;
      
      // Map to expected format
      const userAccess = data.map(item => ({
        id: item.users.id,
        email: item.users.email,
        displayName: item.users.display_name,
        accessLevel: item.access_level
      }));
      
      setCustomerDetails({ userAccess });
    } catch (err) {
      console.error('Error fetching customer access:', err);
    }
  };
  
  // Grant a user access to a customer
  const grantAccess = async (userId: string, accessLevel: string = 'user') => {
    if (!selectedCustomer) return;
    
    try {
      const success = await CustomerService.grantCustomerAccess(
        selectedCustomer.id,
        userId,
        accessLevel
      );
      
      if (success) {
        // Refresh customer details
        openAccessModal(selectedCustomer);
      }
    } catch (err) {
      console.error('Error granting access:', err);
    }
  };
  
  // Revoke a user's access to a customer
  const revokeAccess = async (userId: string) => {
    if (!selectedCustomer) return;
    
    try {
      const success = await CustomerService.revokeCustomerAccess(
        selectedCustomer.id,
        userId
      );
      
      if (success) {
        // Refresh customer details
        openAccessModal(selectedCustomer);
      }
    } catch (err) {
      console.error('Error revoking access:', err);
    }
  };
  
  // Navigate to customer URL
  const goToCustomer = (customerId: string) => {
    navigate(`/${customerId}/admin`);
  };
  
  // Filter customers based on search query
  const filteredCustomers = customers.filter(customer => 
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.id.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <div className="p-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Customer Management</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchCustomers}
              disabled={loading}
              className="p-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              title="Refresh customers"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1 px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              Create Customer
            </button>
          </div>
        </div>
        
        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search customers..."
            className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* Customers Table */}
        <div className="bg-white rounded-lg shadow-sm">
          {loading && customers.length === 0 ? (
            <div className="flex justify-center items-center p-12">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
            </div>
          ) : customers.length === 0 ? (
            <div className="p-12 text-center">
              <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 mb-2">No Customers Found</h2>
              <p className="text-gray-500 mb-4">
                You haven't set up any customers yet or don't have access to any.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                Create Your First Customer
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Users
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rooms
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {customer.id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {customer.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <Users className="w-4 h-4 mr-1 text-gray-400" />
                          {customer.userCount}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <Briefcase className="w-4 h-4 mr-1 text-gray-400" />
                          {customer.roomCount}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          customer.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {customer.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => goToCustomer(customer.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Go to customer"
                          >
                            <Shield className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => openAccessModal(customer)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Manage access"
                          >
                            <Key className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {/* Implement edit functionality */}}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit customer"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Create Customer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Create New Customer</h2>
            
            <form onSubmit={(e) => { e.preventDefault(); handleCreateCustomer(); }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer ID*
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 text-gray-500 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md">
                      {window.location.origin}/
                    </span>
                    <input
                      type="text"
                      value={newCustomerForm.id}
                      onChange={(e) => setNewCustomerForm({...newCustomerForm, id: e.target.value.toLowerCase()})}
                      placeholder="2-4 characters"
                      pattern="[a-z0-9]{2,4}"
                      required
                      maxLength={4}
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-300 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    2-4 lowercase letters and numbers only (a-z, 0-9)
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name*
                  </label>
                  <input
                    type="text"
                    value={newCustomerForm.name}
                    onChange={(e) => setNewCustomerForm({...newCustomerForm, name: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Create Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Access Management Modal */}
      {showAccessModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[80vh] overflow-auto">
            <h2 className="text-xl font-semibold mb-2">
              Manage Access for {selectedCustomer.name}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Customer ID: {selectedCustomer.id}
            </p>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Users with Access</h3>
              
              {customerDetails.userAccess.length === 0 ? (
                <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                  No users have been granted access to this customer.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Access Level
                        </th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {customerDetails.userAccess.map((user, index) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {user.displayName || user.email}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.accessLevel === 'owner'
                                ? 'bg-purple-100 text-purple-800'
                                : user.accessLevel === 'admin'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                            }`}>
                              {user.accessLevel}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => revokeAccess(user.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Grant Access</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    defaultValue=""
                  >
                    <option value="" disabled>Select a user...</option>
                    {users
                      .filter(user => !customerDetails.userAccess.some(u => u.id === user.id))
                      .map(user => (
                        <option key={user.id} value={user.id}>
                          {user.displayName || user.email}
                        </option>
                      ))
                    }
                  </select>
                </div>
                
                <div>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    defaultValue="user"
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => {
                    const selectEl = document.querySelector('select') as HTMLSelectElement;
                    const levelEl = document.querySelectorAll('select')[1] as HTMLSelectElement;
                    if (selectEl && selectEl.value) {
                      grantAccess(selectEl.value, levelEl.value);
                    }
                  }}
                  className="px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700"
                >
                  Grant Access
                </button>
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={() => setShowAccessModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}