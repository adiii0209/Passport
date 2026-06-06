import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  HiOutlineViewGrid,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlinePlus,
  HiOutlineSearch,
  HiOutlineLogout,
  HiOutlinePencilAlt,
  HiOutlineTrash,
  HiOutlineEye,
  HiOutlineTerminal
} from 'react-icons/hi';
import { getPortals, togglePortal, deletePortal, logout } from '../services/adminApi';

const AdminDashboard = () => {
  const [portals, setPortals] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await getPortals();
      setPortals(data.portals || []);
      if (data.stats) setStats(data.stats);
    } catch (error) {
      toast.error(error.message || 'Failed to load portals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleToggle = async (id, currentStatus) => {
    try {
      await togglePortal(id);
      setPortals(portals.map(p => 
        p._id === id ? { ...p, isActive: !currentStatus } : p
      ));
      toast.success(`Portal ${currentStatus ? 'deactivated' : 'activated'}`, {
        style: { background: '#333', color: '#fff', borderRadius: '10px' }
      });
      
      setStats(prev => ({
        ...prev,
        active: currentStatus ? prev.active - 1 : prev.active + 1,
        inactive: currentStatus ? prev.inactive + 1 : prev.inactive - 1
      }));
    } catch (error) {
      toast.error('Failed to toggle portal status');
    }
  };

  const handleDelete = async (id, title) => {
    const targetPortal = portals.find((portal) => portal._id === id);

    if (targetPortal?.isRootPortal) {
      window.alert('Do you wanna start a war?');
      return;
    }

    if (window.confirm(`Are you sure you want to delete the portal "${title}"? This cannot be undone.`)) {
      try {
        await deletePortal(id);
        const deletedPortal = targetPortal;
        setPortals(portals.filter(p => p._id !== id));
        toast.success('Portal deleted');
        
        setStats(prev => ({
          total: prev.total - 1,
          active: deletedPortal?.isActive ? prev.active - 1 : prev.active,
          inactive: !deletedPortal?.isActive ? prev.inactive - 1 : prev.inactive
        }));
      } catch (error) {
        toast.error('Failed to delete portal');
      }
    }
  };

  const filteredPortals = portals.filter(p => 
    p.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.slug?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPortalPublicPath = (portal) => (portal?.isRootPortal ? '/' : `/${portal?.slug || ''}`);

  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-indigo-500/30 font-sans">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-50 px-6 py-4 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
                <HiOutlineTerminal size={24} className="text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                Portal Admin
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 text-xs font-semibold tracking-wide uppercase bg-white/10 text-gray-300 rounded-full border border-white/10">
                Admin
              </span>
              <button 
                onClick={logout} 
                className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
                title="Logout"
              >
                <HiOutlineLogout size={20} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">
          {/* Stats Section */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <motion.div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-3xl p-6 flex items-center gap-5 relative overflow-hidden group"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="p-4 bg-indigo-500/20 rounded-2xl text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                <HiOutlineViewGrid size={32} />
              </div>
              <div>
                <div className="text-3xl font-bold tracking-tight text-white">{stats.total}</div>
                <div className="text-sm font-medium text-gray-400 mt-1">Total Portals</div>
              </div>
            </motion.div>
            
            <motion.div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-3xl p-6 flex items-center gap-5 relative overflow-hidden group"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="p-4 bg-emerald-500/20 rounded-2xl text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <HiOutlineCheckCircle size={32} />
              </div>
              <div>
                <div className="text-3xl font-bold tracking-tight text-white">{stats.active}</div>
                <div className="text-sm font-medium text-gray-400 mt-1">Active Portals</div>
              </div>
            </motion.div>
            
            <motion.div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-3xl p-6 flex items-center gap-5 relative overflow-hidden group"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="absolute inset-0 bg-gradient-to-br from-gray-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="p-4 bg-gray-500/20 rounded-2xl text-gray-400 border border-gray-500/20">
                <HiOutlineXCircle size={32} />
              </div>
              <div>
                <div className="text-3xl font-bold tracking-tight text-white">{stats.inactive}</div>
                <div className="text-sm font-medium text-gray-400 mt-1">Inactive Portals</div>
              </div>
            </motion.div>
          </section>

          {/* Toolbar */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 bg-white/[0.02] p-4 rounded-2xl border border-white/5 backdrop-blur-md">
            <div className="relative w-full md:w-96">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <HiOutlineSearch size={20} className="text-gray-500" />
              </div>
              <input 
                type="text" 
                placeholder="Search portals by name or slug..." 
                className="w-full bg-[#18181b] border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all duration-300 shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] hover:-translate-y-0.5"
              onClick={() => navigate('/admin/portals/new')}
            >
              <HiOutlinePlus size={20} />
              Create Portal
            </button>
          </div>

          {/* Portals Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : filteredPortals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-sm">
              <div className="p-6 bg-white/5 rounded-full mb-6">
                <HiOutlineViewGrid size={48} className="text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No portals found</h3>
              <p className="text-gray-400 max-w-md text-center">
                {searchTerm ? 'We couldn\'t find any portals matching your search criteria.' : 'You haven\'t created any registration portals yet.'}
              </p>
              {!searchTerm && (
                <button 
                  className="mt-8 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-medium rounded-xl transition-all duration-300"
                  onClick={() => navigate('/admin/portals/new')}
                >
                  Create Your First Portal
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredPortals.map((portal, index) => (
                  <motion.div 
                    key={portal._id}
                    className="flex flex-col bg-[#18181b]/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden hover:border-white/20 hover:shadow-xl hover:shadow-black/40 transition-all duration-300 group"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    layout
                  >
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex justify-between items-start gap-4 mb-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-semibold text-white truncate" title={portal.title}>
                            {portal.title}
                          </h3>
                          {portal.isRootPortal && (
                            <span className="inline-flex mt-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] rounded-lg border border-indigo-400/30 bg-indigo-400/10 text-indigo-300">
                              Root Portal
                            </span>
                          )}
                          <a 
                            href={getPortalPublicPath(portal)} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="inline-flex items-center mt-1 text-sm text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
                          >
                            {getPortalPublicPath(portal)} <HiOutlineEye className="ml-1.5" size={14} />
                          </a>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-lg border ${
                          portal.isActive 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }`}>
                          {portal.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      
                      <div className="py-4 border-t border-b border-white/5 my-auto">
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Travel Dates</div>
                        <div className="text-sm text-gray-300">
                          {portal.travelDates?.displayText || (portal.travelDates?.start ? `${portal.travelDates.start} to ${portal.travelDates.end}` : 'Dates not set')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="px-4 py-4 bg-[#09090b]/50 border-t border-white/5 flex gap-2">
                      <button 
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-300 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl border border-white/5 transition-all duration-200"
                        onClick={() => navigate(`/admin/portals/${portal._id}/edit`)}
                      >
                        <HiOutlinePencilAlt size={16} /> Edit
                      </button>
                      <button 
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-xl border transition-all duration-200 ${
                          portal.isActive 
                            ? 'text-amber-400 bg-amber-400/10 border-amber-400/20 hover:bg-amber-400/20 hover:border-amber-400/30' 
                            : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20 hover:bg-emerald-400/20 hover:border-emerald-400/30'
                        }`}
                        onClick={() => handleToggle(portal._id, portal.isActive)}
                      >
                        {portal.isActive ? <><HiOutlineXCircle size={16} /> Disable</> : <><HiOutlineCheckCircle size={16} /> Enable</>}
                      </button>
                      <button 
                        className={`flex items-center justify-center px-4 py-2.5 rounded-xl border transition-all duration-200 ${
                          portal.isRootPortal
                            ? 'text-red-300/70 bg-red-400/5 border-red-400/10 cursor-not-allowed'
                            : 'text-red-400 bg-red-400/10 hover:bg-red-400/20 hover:text-red-300 border-red-400/20'
                        }`}
                        onClick={() => handleDelete(portal._id, portal.title)}
                        title={portal.isRootPortal ? 'Do you wanna start a war?' : 'Delete Portal'}
                      >
                        <HiOutlineTrash size={18} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
