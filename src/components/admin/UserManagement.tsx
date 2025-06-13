import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertCircle, Check, RefreshCw, Search, UserPlus, Edit, Trash, Lock, Key } from 'lucide-react';
import { checkIsAdmin } from '../../lib/check-admin';

interface User {
  id: string;
  email: string;
  display_name?: string;
  role: string;
  created_at: string;
  last_login?: string;
  profile_picture_url?: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    display_name: '',
    role: 'user',
    email: ''
  });

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      const isAdminUser = await checkIsAdmin();
      setIsAdmin(isAdminUser);
      
      if (!isAdminUser) {
        setError('You do not have permission to access this page');
      }
    };
    
    checkAdminStatus();
  }, []);

  // Fetch users
  useEffect(() => {
    if (!isAdmin) return;
    
    fetchUsers();
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Only admins can fetch all users
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setUsers(data || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Error fetching users');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      (user.display_name && user.display_name.toLowerCase().includes(searchLower))
    );
  });

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      display_name: user.display_name || '',
      role: user.role || 'user',
      email: user.email || ''
    });
    setShowEditModal(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    try {
      setLoading(true);
      
      // Update user in the database
      const { error } = await supabase
        .from('users')
        .update({
          display_name: editForm.display_name,
          role: editForm.role
        })
        .eq('id', selectedUser.id);
      
      if (error) throw error;
      
      // Refresh user list
      await fetchUsers();
      setShowEditModal(false);
      
    } catch (err: any) {
      console.error('Error updating user:', err);
      setError(err.message || 'Error updating user');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Delete user from the database
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;
      
      // Refresh user list
      await fetchUsers();
      
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setError(err.message || 'Error deleting user');
    } finally {
      setLoading(false);
    }
  };

  // If not admin, show access denied
  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="p-4 rounded-lg bg-red-100 text-red-700 flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span>Access denied. You need administrator permissions to view this page.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="p-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              title="Refresh users"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {/* Implementation for adding users */}}
              className="flex items-center gap-1 px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700"
            >
              <UserPlus className="w-4 h-4" />
              Add User
            </button>
          </div>
        </div>
        
        {error && (
          <div className="p-4 rounded-lg bg-red-100 text-red-700 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        )}
        
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search users by name or email..."
            className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>
        
        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading && users.length === 0 ? (
            <div className="flex justify-center items-center p-8">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            {user.profile_picture_url ? (
                              <img
                                className="h-10 w-10 rounded-full"
                                src={user.profile_picture_url}
                                alt={user.display_name || user.email}
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                {(user.display_name || user.email).charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.display_name || 'No display name'}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {user.role || 'user'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.last_login 
                          ? new Date(user.last_login).toLocaleString() 
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => openEditModal(user)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {/* Reset password functionality */}}
                            className="text-yellow-600 hover:text-yellow-900"
                          >
                            <Key className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash className="w-5 h-5" />
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

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Edit User</h2>
            
            <form onSubmit={handleUpdateUser}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={editForm.email}
                    disabled={true}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    name="display_name"
                    value={editForm.display_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    name="role"
                    value={editForm.role}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
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
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}