import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { AlertCircle, UserPlus } from 'lucide-react';
import { syncUserRecord } from '../../lib/auth-helpers';

export default function RegisterForm() {
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    
    try {
      // Register the user with Supabase Auth
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: name
          }
        }
      });
      
      if (authError) throw authError;
      
      if (data.user) {
        // Create a user profile in the users table
        await supabase
          .from('users')
          .insert([{ 
            id: data.user.id,
            email: data.user.email,
            display_name: name,
            created_at: new Date().toISOString()
          }]);
          
        // Sync user record to ensure it exists
        await syncUserRecord();
        
        // Redirect to login
        navigate('/login', { 
          state: { message: 'Registration successful! Please sign in.' } 
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="flex flex-col justify-center flex-1 px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="w-full max-w-sm mx-auto lg:w-96">
          <div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Create a new account</h2>
            <p className="mt-2 text-sm text-gray-600">
              Or{' '}
              <Link to="/login" className="font-medium text-purple-600 hover:text-purple-500">
                sign in to your existing account
              </Link>
            </p>
          </div>
          
          <div className="mt-8">
            {error && (
              <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-md">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  <span>{error}</span>
                </div>
              </div>
            )}
            
            <div className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <div className="mt-1">
                    <input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full px-3 py-2 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full px-3 py-2 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="mt-1">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full px-3 py-2 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    Confirm Password
                  </label>
                  <div className="mt-1">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full px-3 py-2 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                    />
                  </div>
                </div>
                
                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                  >
                    {loading ? (
                      <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    ) : (
                      <div className="flex items-center">
                        <UserPlus className="w-5 h-5 mr-2" />
                        Register
                      </div>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <div className="relative flex-1 hidden w-0 lg:block">
        <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-br from-purple-600 to-indigo-800">
          <div className="max-w-md px-8 mx-auto text-center">
            <h1 className="mb-4 text-4xl font-bold text-white">Fusion Events</h1>
            <p className="mb-6 text-xl text-white opacity-90">
              Create an account to start managing interactive events across multiple rooms
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}