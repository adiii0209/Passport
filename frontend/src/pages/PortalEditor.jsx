import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  HiOutlineArrowLeft,
  HiOutlineSave,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineInformationCircle,
  HiOutlineUpload,
  HiOutlinePhotograph,
  HiOutlineVideoCamera,
  HiOutlineTerminal
} from 'react-icons/hi';
import { getPortalById, createPortal, updatePortal, uploadMedia } from '../services/adminApi';
import { resolveMediaUrl } from '../services/api';


const TABS = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'media', label: 'Media & Branding' },
  { id: 'theme', label: 'Theme & Colors' },
  { id: 'docs', label: 'Required Docs' },
  { id: 'advanced', label: 'Advanced Sync' }
];

const DEFAULT_DOCS = [
  { key: 'passport_front', label: 'Passport Front', required: true, helperText: 'Ensure the photo page is clear and glare-free.' },
  { key: 'passport_back', label: 'Passport Back', required: true, helperText: 'Upload the address page from your passport.' },
  { key: 'pan_card', label: 'PAN Card', required: true, helperText: 'Capture the full card within the frame.' },
  { key: 'selfie', label: 'Profile Photo', required: true, helperText: 'Look straight into the camera in good lighting.' }
];

const DEFAULT_REQUIRED_FORM_FIELDS = {
  contact_number: true,
  email: true,
  meal_preference: true,
};

function formatTravelDate(dateStr, includeYear = false) {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

function buildTravelDisplayText(start, end) {
  const startLabel = formatTravelDate(start);
  const endLabel = formatTravelDate(end, true);

  if (startLabel && endLabel) {
    return `${startLabel} - ${endLabel}`;
  }

  return startLabel || endLabel || '';
}

const PortalEditor = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [currentPortalId, setCurrentPortalId] = useState(id || '');
  const fileInputRef = useRef(null);
  const [uploadType, setUploadType] = useState(null); // 'hero' or 'logo'
  const [uploading, setUploading] = useState(false);
  const [newEmailDomain, setNewEmailDomain] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    slug: '',
    isActive: true,
    travelDates: { start: '', end: '', displayText: '' },
    hero: { type: 'image', url: '', driveFileId: '' },
    logo: { url: '', driveFileId: '' },
    theme: { primaryColor: '#6366f1', accentColor: '#f59e0b', heroOverlayOpacity: 0.4 },
    requiredFormFields: { ...DEFAULT_REQUIRED_FORM_FIELDS },
    requiredDocuments: [...DEFAULT_DOCS],
    allowedEmailDomains: [],
    googleSheetId: '',
    photoFolderId: ''
  });
  const isRootPortal = Boolean(formData.isRootPortal);

  useEffect(() => {
    setCurrentPortalId(id || '');
  }, [id]);

  useEffect(() => {
    if (isEdit) {
      const fetchPortal = async () => {
        try {
          const data = await getPortalById(id);
          if (data.success) {
            setCurrentPortalId(data.portal._id || id);
            setFormData({
              ...data.portal,
              requiredFormFields: {
                ...DEFAULT_REQUIRED_FORM_FIELDS,
                ...(data.portal.requiredFormFields || {}),
              },
            });
          }
        } catch (error) {
          toast.error('Failed to load portal configuration');
          navigate('/admin/dashboard');
        } finally {
          setLoading(false);
        }
      };
      fetchPortal();
    }
  }, [id, isEdit, navigate]);

  const handleChange = (path, value) => {
    setFormData(prev => {
      const keys = path.split('.');
      if (keys.length === 1) return { ...prev, [path]: value };
      
      const newData = { ...prev };
      let current = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const handleTravelDateChange = (field, value) => {
    setFormData((prev) => {
      const travelDates = {
        ...prev.travelDates,
        [field]: value,
      };

      travelDates.displayText = buildTravelDisplayText(travelDates.start, travelDates.end);

      return {
        ...prev,
        travelDates,
      };
    });
  };

  const handleTitleChange = (e) => {
    const title = e.target.value;
    setFormData(prev => {
      const updates = { title };
      // Auto-generate slug if not edit mode and user hasn't manually edited slug
      if (!isEdit && (!prev.slug || prev.slug === prev.title.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))) {
        updates.slug = title.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      }
      return { ...prev, ...updates };
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadType) return;

    try {
      setUploading(true);
      let portalIdForUpload = currentPortalId;

      if (!portalIdForUpload) {
        if (!formData.title.trim() || !formData.slug.trim()) {
          toast.error('Please enter and save the portal title and slug before uploading media', {
            id: 'upload',
            style: { background: '#ef4444', color: '#fff', borderRadius: '10px' },
          });
          setActiveTab('basic');
          return;
        }

        toast.loading('Creating portal draft for media upload...', {
          id: 'upload',
          style: { background: '#333', color: '#fff', borderRadius: '10px' },
        });

        const draftResponse = await createPortal(formData);
        portalIdForUpload = draftResponse.portal?._id || '';
        if (!portalIdForUpload) {
          throw new Error('Portal draft was created but no portal ID was returned');
        }

        setCurrentPortalId(portalIdForUpload);
        setFormData((prev) => ({
          ...prev,
          ...draftResponse.portal,
          requiredFormFields: {
            ...DEFAULT_REQUIRED_FORM_FIELDS,
            ...(draftResponse.portal.requiredFormFields || prev.requiredFormFields || {}),
          },
        }));
        navigate(`/admin/portals/${portalIdForUpload}/edit`, { replace: true });
      }

      toast.loading(`Uploading ${uploadType}...`, { id: 'upload', style: { background: '#333', color: '#fff', borderRadius: '10px' } });
      const data = await uploadMedia(file, uploadType, portalIdForUpload);
      
      if (data.success) {
        if (uploadType === 'hero') {
          handleChange('hero.url', data.file.url);
          handleChange('hero.driveFileId', data.file.id);
          // Auto-detect type from file
          if (file.type.startsWith('video/')) {
            handleChange('hero.type', 'video');
          } else {
            handleChange('hero.type', 'image');
          }
        } else if (uploadType === 'logo') {
          handleChange('logo.url', data.file.url);
          handleChange('logo.driveFileId', data.file.id);
        }
        toast.success('Upload complete', { id: 'upload' });
      }
    } catch (error) {
      toast.error(error.message || 'Upload failed', { id: 'upload' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadType(null);
    }
  };

  const triggerUpload = (type) => {
    setUploadType(type);
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const addEmailDomain = (e) => {
    e.preventDefault();
    if (!newEmailDomain.trim()) return;
    
    let domain = newEmailDomain.trim().toLowerCase();
    if (domain.startsWith('@')) domain = domain.substring(1);
    
    if (!formData.allowedEmailDomains.includes(domain)) {
      handleChange('allowedEmailDomains', [...formData.allowedEmailDomains, domain]);
    }
    setNewEmailDomain('');
  };

  const removeEmailDomain = (domainToRemove) => {
    handleChange('allowedEmailDomains', formData.allowedEmailDomains.filter(d => d !== domainToRemove));
  };

  const handleDocChange = (index, field, value) => {
    const newDocs = [...formData.requiredDocuments];
    newDocs[index] = { ...newDocs[index], [field]: value };
    handleChange('requiredDocuments', newDocs);
  };

  const removeDoc = (index) => {
    const newDocs = [...formData.requiredDocuments];
    newDocs.splice(index, 1);
    handleChange('requiredDocuments', newDocs);
  };

  const addDoc = () => {
    handleChange('requiredDocuments', [
      ...formData.requiredDocuments,
      { key: `custom_${Date.now()}`, label: 'New Document', required: true, helperText: '' }
    ]);
  };

  const handleRequiredFormFieldChange = (field, value) => {
    handleChange('requiredFormFields', {
      ...DEFAULT_REQUIRED_FORM_FIELDS,
      ...(formData.requiredFormFields || {}),
      [field]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.slug.trim()) {
      toast.error('Title and Slug are required', { style: { background: '#ef4444', color: '#fff', borderRadius: '10px' } });
      setActiveTab('basic');
      return;
    }

    try {
      setSaving(true);
      toast.loading('Saving portal...', { id: 'save', style: { background: '#333', color: '#fff', borderRadius: '10px' } });
      
      if (isEdit) {
        await updatePortal(id, formData);
        toast.success('Portal updated successfully', { id: 'save' });
      } else {
        const response = await createPortal(formData);
        setCurrentPortalId(response.portal._id || '');
        toast.success('Portal created successfully', { id: 'save' });
        navigate(`/admin/portals/${response.portal._id}/edit`, { replace: true });
      }
    } catch (error) {
      toast.error(error.message || 'Failed to save portal', { id: 'save', style: { background: '#ef4444', color: '#fff', borderRadius: '10px' } });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex justify-center items-center font-sans">
        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-indigo-500/30 font-sans">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-50 px-6 py-4 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <button 
                type="button"
                className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-white/10" 
                onClick={(e) => { e.preventDefault(); navigate('/admin/dashboard'); }}
                title="Back to Dashboard"
              >
                <HiOutlineArrowLeft size={20} />
              </button>
              <div className="flex-1 min-w-0 border-l border-white/10 pl-4">
                <h1 className="text-xl font-bold tracking-tight text-white truncate">
                  {isEdit ? `Edit: ${formData.title}` : 'Create New Portal'}
                </h1>
                {formData.slug && (
                  <span className="text-sm font-medium text-indigo-400 truncate block mt-0.5">
                    {isRootPortal ? '/' : `/${formData.slug}`}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-6 self-end sm:self-auto">
              <label className="flex items-center gap-3 cursor-pointer group">
                <span className="text-sm font-medium text-gray-400 group-hover:text-gray-300 transition-colors">Active Status</span>
                <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${formData.isActive ? 'bg-emerald-500' : 'bg-gray-600'}`}>
                  <input 
                    type="checkbox" 
                    className="sr-only"
                    checked={formData.isActive}
                    onChange={(e) => handleChange('isActive', e.target.checked)}
                  />
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${formData.isActive ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
              </label>
              <button 
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none" 
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <HiOutlineSave size={18} />
                )}
                <span>{saving ? 'Saving...' : 'Save Portal'}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 flex-shrink-0">
              <div className="bg-[#18181b]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 sticky top-28 shadow-xl">
                <div className="flex flex-col space-y-1">
                  {TABS.map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`px-4 py-3 rounded-xl text-sm font-medium text-left transition-all duration-200 ${
                        activeTab === tab.id 
                          ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' 
                          : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0">
              <form className="bg-[#18181b]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-xl min-h-[500px]" onSubmit={handleSubmit}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* BASIC INFO TAB */}
                    {activeTab === 'basic' && (
                      <div className="space-y-8">
                        <div>
                          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Basic Information</h2>
                          <p className="text-gray-400 text-sm">Set up the core details for this registration portal.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Portal Title <span className="text-red-400">*</span></label>
                            <input 
                              type="text" 
                              className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder-gray-600" 
                              value={formData.title} 
                              onChange={handleTitleChange}
                              placeholder="e.g. Axxela Annual Retreat"
                              required
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">URL Slug <span className="text-red-400">*</span></label>
                            <div className="flex bg-[#09090b] border border-white/10 rounded-xl overflow-hidden focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
                              <span className="px-4 py-3 bg-white/5 text-gray-500 border-r border-white/10 select-none">passport.timetours.in/</span>
                              <input 
                                type="text" 
                                className="flex-1 bg-transparent px-4 py-3 text-white outline-none placeholder-gray-600" 
                                value={formData.slug} 
                                onChange={(e) => handleChange('slug', e.target.value)}
                                placeholder="axxela-retreat"
                                required
                                disabled={isRootPortal}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {isRootPortal
                                ? 'The root portal always stays on /. You can edit its content, but its public path is locked.'
                                : 'This forms the public URL. Use only lowercase letters, numbers, and hyphens.'}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Subtitle</label>
                            <input 
                              type="text" 
                              className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder-gray-600" 
                              value={formData.subtitle} 
                              onChange={(e) => handleChange('subtitle', e.target.value)}
                              placeholder="e.g. Join us in Langkawi for 3 days of fun"
                            />
                          </div>
                        </div>

                        <div className="h-px bg-white/10 w-full my-8" />
                        
                        <div>
                          <h3 className="text-lg font-semibold text-white mb-6">Travel Dates</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-300">Start Date</label>
                              <input 
                                type="date" 
                                className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all [color-scheme:dark]" 
                                value={formData.travelDates.start} 
                                onChange={(e) => handleTravelDateChange('start', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-300">End Date</label>
                              <input 
                                type="date" 
                                className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all [color-scheme:dark]" 
                                value={formData.travelDates.end} 
                                onChange={(e) => handleTravelDateChange('end', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2 lg:col-span-1 md:col-span-2">
                              <label className="text-sm font-medium text-gray-300">Display Text</label>
                              <input 
                                type="text" 
                                className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-gray-400 outline-none transition-all placeholder-gray-600 cursor-not-allowed" 
                                value={formData.travelDates.displayText} 
                                readOnly
                                tabIndex={-1}
                                placeholder="Auto-synced from start and end dates"
                              />
                              <p className="text-xs text-gray-500">This is generated from the start and end dates and stays in sync automatically.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* MEDIA TAB */}
                    {activeTab === 'media' && (
                      <div className="space-y-10">
                        <div>
                          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Media & Branding</h2>
                          <p className="text-gray-400 text-sm">Upload logos and background imagery to customize the look.</p>
                        </div>
                        
                        {/* Hidden file input for uploads */}
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          onChange={handleFileUpload} 
                          accept={uploadType === 'hero' ? 'image/*,video/*' : 'image/*'} 
                        />

                        {/* Logo Section */}
                        <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                          <h3 className="text-lg font-semibold text-white mb-6 flex items-center">
                            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg mr-3">
                              <HiOutlinePhotograph size={20} />
                            </div>
                            Portal Logo
                          </h3>
                          <div className="flex flex-col md:flex-row gap-8 items-start">
                            <div className="flex-1 w-full space-y-4">
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Logo Image URL</label>
                                <input 
                                  type="text" 
                                  className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder-gray-600" 
                                  value={formData.logo.url} 
                                  onChange={(e) => handleChange('logo.url', e.target.value)}
                                  placeholder="https://..."
                                />
                              </div>
                              <div className="relative">
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                  <div className="w-full border-t border-white/10"></div>
                                </div>
                                <div className="relative flex justify-center">
                                  <span className="bg-[#18181b] px-3 text-xs text-gray-500 uppercase tracking-widest font-medium">OR</span>
                                </div>
                              </div>
                              <button 
                                type="button"
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-medium rounded-xl transition-all duration-300"
                                onClick={() => triggerUpload('logo')}
                                disabled={uploading}
                              >
                                {uploading && uploadType === 'logo' ? (
                                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                  <HiOutlineUpload size={20} />
                                )}
                                Upload Logo Image
                              </button>
                            </div>
                            <div className="w-full md:w-64 h-48 bg-[#09090b] border border-white/10 rounded-2xl flex items-center justify-center p-6 flex-shrink-0 relative group overflow-hidden">
                              <div className="absolute inset-0 bg-grid-white/[0.02] bg-[length:16px_16px]" />
                              {formData.logo.url ? (
                                <img src={resolveMediaUrl(formData.logo.url)} alt="Logo preview" className="max-h-full max-w-full object-contain relative z-10" />
                              ) : (
                                <div className="text-gray-600 text-sm font-medium relative z-10">No logo set</div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Hero Section */}
                        <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                          <h3 className="text-lg font-semibold text-white mb-6 flex items-center">
                            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg mr-3">
                              <HiOutlineVideoCamera size={20} />
                            </div>
                            Hero Background
                          </h3>
                          
                          <div className="space-y-4 mb-6">
                            <label className="text-sm font-medium text-gray-300">Background Media Type</label>
                            <div className="flex gap-4">
                              <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border cursor-pointer transition-all ${formData.hero.type === 'image' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-[#09090b] border-white/10 text-gray-400 hover:bg-white/5'}`}>
                                <input 
                                  type="radio" 
                                  className="sr-only"
                                  checked={formData.hero.type === 'image'} 
                                  onChange={() => handleChange('hero.type', 'image')}
                                />
                                <HiOutlinePhotograph size={20} /> Static Image
                              </label>
                              <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border cursor-pointer transition-all ${formData.hero.type === 'video' ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' : 'bg-[#09090b] border-white/10 text-gray-400 hover:bg-white/5'}`}>
                                <input 
                                  type="radio" 
                                  className="sr-only"
                                  checked={formData.hero.type === 'video'} 
                                  onChange={() => handleChange('hero.type', 'video')}
                                />
                                <HiOutlineVideoCamera size={20} /> Looping Video
                              </label>
                            </div>
                          </div>

                          <div className="flex flex-col md:flex-row gap-8 items-start">
                            <div className="flex-1 w-full space-y-4">
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Media URL</label>
                                <input 
                                  type="text" 
                                  className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder-gray-600" 
                                  value={formData.hero.url} 
                                  onChange={(e) => handleChange('hero.url', e.target.value)}
                                  placeholder="https://..."
                                />
                              </div>
                              <div className="relative">
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                  <div className="w-full border-t border-white/10"></div>
                                </div>
                                <div className="relative flex justify-center">
                                  <span className="bg-[#18181b] px-3 text-xs text-gray-500 uppercase tracking-widest font-medium">OR</span>
                                </div>
                              </div>
                              <button 
                                type="button"
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-medium rounded-xl transition-all duration-300"
                                onClick={() => triggerUpload('hero')}
                                disabled={uploading}
                              >
                                {uploading && uploadType === 'hero' ? (
                                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                  <HiOutlineUpload size={20} />
                                )}
                                Upload New Media
                              </button>
                            </div>
                            <div className="w-full md:w-64 h-48 bg-[#09090b] border border-white/10 rounded-2xl flex items-center justify-center flex-shrink-0 relative overflow-hidden group">
                              {formData.hero.url ? (
                                formData.hero.type === 'video' ? (
                                  <video src={resolveMediaUrl(formData.hero.url)} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" autoPlay muted loop playsInline />
                                ) : (
                                  <img src={resolveMediaUrl(formData.hero.url)} alt="Hero preview" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                )
                              ) : (
                                <div className="text-gray-600 text-sm font-medium z-10">No hero set</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* THEME TAB */}
                    {activeTab === 'theme' && (
                      <div className="space-y-10">
                        <div>
                          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Theme & Colors</h2>
                          <p className="text-gray-400 text-sm">Match the portal to your brand's visual identity.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                            <div>
                              <h3 className="text-lg font-medium text-white mb-1">Primary Color</h3>
                              <p className="text-xs text-gray-400">Used for primary buttons, active states, and accents.</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-lg border border-white/20 flex-shrink-0">
                                <input 
                                  type="color" 
                                  className="absolute top-[-10px] left-[-10px] w-20 h-20 cursor-pointer" 
                                  value={formData.theme.primaryColor} 
                                  onChange={(e) => handleChange('theme.primaryColor', e.target.value)}
                                />
                              </div>
                              <input 
                                type="text" 
                                className="flex-1 bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 uppercase font-mono tracking-wider transition-all" 
                                value={formData.theme.primaryColor} 
                                onChange={(e) => handleChange('theme.primaryColor', e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                            <div>
                              <h3 className="text-lg font-medium text-white mb-1">Accent Color</h3>
                              <p className="text-xs text-gray-400">Used for highlights, secondary elements, and gradients.</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-lg border border-white/20 flex-shrink-0">
                                <input 
                                  type="color" 
                                  className="absolute top-[-10px] left-[-10px] w-20 h-20 cursor-pointer" 
                                  value={formData.theme.accentColor} 
                                  onChange={(e) => handleChange('theme.accentColor', e.target.value)}
                                />
                              </div>
                              <input 
                                type="text" 
                                className="flex-1 bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 uppercase font-mono tracking-wider transition-all" 
                                value={formData.theme.accentColor} 
                                onChange={(e) => handleChange('theme.accentColor', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                          <div className="flex justify-between items-end mb-2">
                            <div>
                              <h3 className="text-lg font-medium text-white mb-1">Hero Overlay Opacity</h3>
                              <p className="text-xs text-gray-400">Controls how dark the overlay is on the hero image/video.</p>
                            </div>
                            <div className="text-2xl font-bold font-mono text-indigo-400">{formData.theme.heroOverlayOpacity.toFixed(2)}</div>
                          </div>
                          
                          <input 
                            type="range" 
                            min="0" max="1" step="0.05"
                            className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                            value={formData.theme.heroOverlayOpacity} 
                            onChange={(e) => handleChange('theme.heroOverlayOpacity', parseFloat(e.target.value))}
                          />
                          <div className="flex justify-between text-xs font-medium text-gray-500 pt-1">
                            <span>0.0 (Transparent)</span>
                            <span>0.5 (Balanced)</span>
                            <span>1.0 (Solid Dark)</span>
                          </div>
                        </div>

                        {/* Theme Preview */}
                        <div className="mt-8 p-8 rounded-3xl border border-white/10 relative overflow-hidden shadow-2xl">
                          <div 
                            className="absolute inset-0 opacity-20 pointer-events-none" 
                            style={{ background: `linear-gradient(135deg, ${formData.theme.primaryColor}, ${formData.theme.accentColor})` }}
                          />
                          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[length:16px_16px] pointer-events-none" />
                          
                          <div className="relative z-10 flex flex-col items-center text-center">
                            <div 
                              className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold tracking-wide mb-6"
                              style={{ backgroundColor: `${formData.theme.accentColor}20`, color: formData.theme.accentColor }}
                            >
                              PREVIEW RENDERING
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-4">Your Portal Looks Like This</h3>
                            <p className="text-gray-400 max-w-md mx-auto mb-8">This is how your selected colors will apply to buttons, accents, and interactive elements across the site.</p>
                            
                            <div className="flex flex-wrap justify-center gap-4">
                              <button 
                                type="button" 
                                className="px-8 py-3.5 rounded-xl font-medium text-white shadow-lg transition-transform hover:scale-105 hover:shadow-xl"
                                style={{ 
                                  backgroundColor: formData.theme.primaryColor,
                                  boxShadow: `0 10px 25px -5px ${formData.theme.primaryColor}50`
                                }}
                              >
                                Primary Action
                              </button>
                              <button 
                                type="button" 
                                className="px-8 py-3.5 rounded-xl font-medium bg-white/5 backdrop-blur-md border border-white/10 transition-colors"
                                style={{ color: formData.theme.accentColor, borderColor: `${formData.theme.accentColor}40` }}
                              >
                                Secondary Action
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* DOCS TAB */}
                    {activeTab === 'docs' && (
                      <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                          <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Required Documents</h2>
                            <p className="text-gray-400 text-sm mt-1">Configure the files users must upload during registration.</p>
                          </div>
                          <button 
                            type="button" 
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 rounded-xl transition-all" 
                            onClick={addDoc}
                          >
                            <HiOutlinePlus size={18} /> Add Document Field
                          </button>
                        </div>
                        
                        <div className="space-y-4">
                          {formData.requiredDocuments.map((doc, index) => {
                            const isCoreDoc = ['passport_front', 'passport_back', 'pan_card', 'selfie'].includes(doc.key);
                            
                            return (
                              <div key={index} className="bg-[#09090b] p-5 rounded-2xl border border-white/10 relative group hover:border-white/20 transition-all">
                                {!isCoreDoc && (
                                  <button 
                                    type="button" 
                                    className="absolute top-4 right-4 p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                    onClick={() => removeDoc(index)}
                                    title="Remove document field"
                                  >
                                    <HiOutlineTrash size={18} />
                                  </button>
                                )}
                                
                                {isCoreDoc && (
                                  <div className="absolute top-4 right-4 px-2 py-1 bg-indigo-500/10 text-indigo-400 text-xs font-semibold rounded-md uppercase tracking-wider border border-indigo-500/20">
                                    Core Field
                                  </div>
                                )}
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mr-16 md:mr-0 mt-2 md:mt-0">
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Field Identifier (Key)</label>
                                    <input 
                                      type="text" 
                                      className={`w-full bg-[#18181b] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono transition-all ${isCoreDoc ? 'text-gray-500 cursor-not-allowed' : 'text-white focus:border-indigo-500/50'}`} 
                                      value={doc.key} 
                                      onChange={(e) => handleDocChange(index, 'key', e.target.value)}
                                      disabled={isCoreDoc}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Display Label</label>
                                    <input 
                                      type="text" 
                                      className="w-full bg-[#18181b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 transition-all" 
                                      value={doc.label} 
                                      onChange={(e) => handleDocChange(index, 'label', e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2 md:col-span-2">
                                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Helper Instructions</label>
                                    <input 
                                      type="text" 
                                      className="w-full bg-[#18181b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 transition-all" 
                                      value={doc.helperText} 
                                      onChange={(e) => handleDocChange(index, 'helperText', e.target.value)}
                                    />
                                  </div>
                                </div>
                                
                                <div className="mt-5 pt-5 border-t border-white/5">
                                  <label className="flex items-center gap-3 cursor-pointer w-fit">
                                    <div className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${doc.required ? 'bg-indigo-500' : 'bg-gray-700'}`}>
                                      <input 
                                        type="checkbox" 
                                        className="sr-only"
                                        checked={doc.required}
                                        onChange={(e) => handleDocChange(index, 'required', e.target.checked)}
                                      />
                                      <div className={`absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform duration-300 ${doc.required ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                    <span className="text-sm font-medium text-gray-300 select-none">Mandatory Field</span>
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                          
                          {formData.requiredDocuments.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-500 border-2 border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                              <HiOutlineUpload size={32} className="mb-3 opacity-50" />
                              <p className="font-medium text-white mb-1">No documents required</p>
                              <p className="text-sm">Click "Add Document Field" above to add one.</p>
                            </div>
                          )}
                        </div>

                        <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-2xl">
                          <h3 className="text-lg font-semibold text-white mb-2">Traveler Detail Requirements</h3>
                          <p className="text-sm text-gray-400 mb-6">
                            Configure whether phone number, email, and meal preference are mandatory on the details step.
                          </p>

                          <div className="space-y-4">
                            {[
                              { key: 'contact_number', label: 'Phone Number', helper: 'Require a contact number before submission.' },
                              { key: 'email', label: 'Email Address', helper: 'Require an email address before submission.' },
                              { key: 'meal_preference', label: 'Meal Preference', helper: 'Require the traveler to choose a meal preference.' },
                            ].map((field) => {
                              const isRequired = formData.requiredFormFields?.[field.key] !== false;
                              return (
                                <div
                                  key={field.key}
                                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#09090b] px-4 py-4"
                                >
                                  <div>
                                    <div className="text-sm font-semibold text-white">{field.label}</div>
                                    <div className="text-xs text-gray-400 mt-1">{field.helper}</div>
                                  </div>
                                  <label className="flex items-center gap-3 cursor-pointer w-fit">
                                    <span className={`text-xs font-semibold uppercase tracking-wider ${isRequired ? 'text-indigo-300' : 'text-gray-500'}`}>
                                      {isRequired ? 'Mandatory' : 'Optional'}
                                    </span>
                                    <div className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${isRequired ? 'bg-indigo-500' : 'bg-gray-700'}`}>
                                      <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={isRequired}
                                        onChange={(e) => handleRequiredFormFieldChange(field.key, e.target.checked)}
                                      />
                                      <div className={`absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform duration-300 ${isRequired ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        <div className="mt-8 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 flex gap-4 items-start">
                          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg flex-shrink-0">
                            <HiOutlineInformationCircle size={24} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-blue-100 mb-1">Important System Note</h4>
                            <p className="text-sm text-blue-200/70 leading-relaxed">
                              The AI extraction pipeline specifically looks for files with keys <code className="px-1.5 py-0.5 bg-black/30 rounded text-blue-300 font-mono text-xs">passport_front</code>, <code className="px-1.5 py-0.5 bg-black/30 rounded text-blue-300 font-mono text-xs">passport_back</code>, and <code className="px-1.5 py-0.5 bg-black/30 rounded text-blue-300 font-mono text-xs">pan_card</code>. 
                              Renaming these keys or removing them will prevent the automatic OCR and validation from working correctly. You may add as many custom fields as needed.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ADVANCED / ACCESS TAB */}
                    {activeTab === 'advanced' && (
                      <div className="space-y-10">
                        <div>
                          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Access Control & Sync</h2>
                          <p className="text-gray-400 text-sm">Manage who can register and where the data flows.</p>
                        </div>
                        
                        <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                          <h3 className="text-lg font-semibold text-white mb-1">Domain Restrictions</h3>
                          <p className="text-sm text-gray-400 mb-6">Restrict registration to specific email domains (e.g. company.com). Leave empty to allow any email address.</p>
                          
                          <div className="flex flex-col sm:flex-row gap-3 mb-6">
                            <div className="relative flex-1">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">@</span>
                              <input 
                                type="text" 
                                className="w-full bg-[#09090b] border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white outline-none focus:border-indigo-500/50 transition-all placeholder-gray-600" 
                                placeholder="company.com" 
                                value={newEmailDomain}
                                onChange={(e) => setNewEmailDomain(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addEmailDomain(e);
                                  }
                                }}
                              />
                            </div>
                            <button 
                              type="button" 
                              onClick={addEmailDomain} 
                              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all border border-white/10 hover:border-white/30 whitespace-nowrap"
                            >
                              Add Domain
                            </button>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 min-h-[48px] p-4 bg-[#09090b] border border-white/5 rounded-xl">
                            {formData.allowedEmailDomains.map(domain => (
                              <div key={domain} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium rounded-lg group">
                                @{domain}
                                <button 
                                  type="button" 
                                  onClick={() => removeEmailDomain(domain)} 
                                  className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-200 transition-colors"
                                >
                                  &times;
                                </button>
                              </div>
                            ))}
                            {formData.allowedEmailDomains.length === 0 && (
                              <div className="text-sm text-gray-500 italic w-full text-center py-1">No restrictions applied. Anyone can register.</div>
                            )}
                          </div>
                        </div>

                        <div className="h-px bg-white/10 w-full" />

                        <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                          <h3 className="text-lg font-semibold text-white mb-1">Google Workspace Integrations</h3>
                          <p className="text-sm text-gray-400 mb-6">Override global environment variables to push this portal's data to specific Google Sheets or Drive folders.</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-300">Dedicated Google Sheet ID</label>
                              <input 
                                type="text" 
                                className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-sm placeholder-gray-600" 
                                value={formData.googleSheetId} 
                                onChange={(e) => handleChange('googleSheetId', e.target.value)}
                                placeholder="Leave blank to use default sheet"
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-300">Dedicated Drive Folder ID</label>
                              <input 
                                type="text" 
                                className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-sm placeholder-gray-600" 
                                value={formData.photoFolderId} 
                                onChange={(e) => handleChange('photoFolderId', e.target.value)}
                                placeholder="Leave blank to use default folder"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PortalEditor;
