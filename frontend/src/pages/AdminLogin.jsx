import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { HiOutlineLockClosed } from 'react-icons/hi';
import { login, isAuthenticated } from '../services/adminApi';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/admin/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please enter both username and password');
      return;
    }

    setIsLoading(true);
    try {
      await login(username, password);
      toast.success('Login successful', {
        style: { background: '#333', color: '#fff', borderRadius: '10px' }
      });
      navigate('/admin/dashboard');
    } catch (error) {
      toast.error(error.message || 'Login failed', {
        style: { background: '#ef4444', color: '#fff', borderRadius: '10px' }
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        className="w-full max-w-md bg-[#18181b]/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-8 relative z-10"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120 }}
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 mb-6 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
            <HiOutlineLockClosed size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Admin Access</h2>
          <p className="text-gray-400 text-sm">Sign in to manage your custom registration portals.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative group">
            <input
              type="text"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 pt-6 pb-2 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all peer"
              placeholder=" "
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              required
            />
            <label className="absolute left-4 top-4 text-gray-500 text-sm peer-focus:text-xs peer-focus:top-2 peer-focus:text-indigo-400 peer-valid:text-xs peer-valid:top-2 transition-all pointer-events-none">
              Username
            </label>
          </div>

          <div className="relative group">
            <input
              type="password"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 pt-6 pb-2 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all peer"
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
            <label className="absolute left-4 top-4 text-gray-500 text-sm peer-focus:text-xs peer-focus:top-2 peer-focus:text-indigo-400 peer-valid:text-xs peer-valid:top-2 transition-all pointer-events-none">
              Password
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex justify-center items-center h-[52px]"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </motion.div>
      
      <div className="mt-8 text-xs text-gray-600 tracking-wider">
        SECURE ADMIN SYSTEM
      </div>
    </div>
  );
};

export default AdminLogin;
