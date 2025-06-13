import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { loginUser } from '../../lib/auth-helpers';
import { supabase } from '../../lib/supabase';

export default function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  
  // Check if user is already logged in
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        
        if (data.session) {
          console.log('User already has a session, redirecting to:', from);
          navigate(from, { replace: true });
        }
      } catch (err) {
        console.error('Error checking session:', err);
      } finally {
        setSessionChecked(true);
      }
    };
    
    checkExistingSession();
  }, [navigate, from]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      console.log('Attempting login with email:', email);
      const { user, error: loginError } = await loginUser(email, password);
      
      if (loginError) {
        setError(loginError);
        return;
      }
      
      if (user) {
        console.log('Login successful, redirecting to:', from);
        // Small delay to ensure UI updates before redirecting
        setTimeout(() => {
          navigate(from, { replace: true });
        }, 100);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch (err: any) {
      console.error('Unexpected login error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  // Don't render anything until we've checked for an existing session
  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="w-16 h-16 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="flex flex-col justify-center flex-1 px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="w-full max-w-sm mx-auto lg:w-96">
          <div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
            <p className="mt-2 text-sm text-gray-600">
              Or{' '}
              <Link to="/register" className="font-medium text-purple-600 hover:text-purple-500">
                create a new account
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
                  <div className="mt-1 relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full px-3 py-2 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="remember-me" className="block ml-2 text-sm text-gray-900">
                      Remember me
                    </label>
                  </div>
                  
                  <div className="text-sm">
                    <Link to="/forgot-password" className="font-medium text-purple-600 hover:text-purple-500">
                      Forgot your password?
                    </Link>
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
                        <LogIn className="w-5 h-5 mr-2" />
                        Sign in
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
              Your complete solution for managing interactive events across multiple rooms
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}