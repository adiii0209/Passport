/**
 * PortalLanding — Dynamic portal page
 * Fetches portal config by slug from URL, renders a fully branded
 * registration experience with the portal's hero, theme, and documents.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  HiOutlineArrowRight,
  HiOutlineCheckCircle,
  HiOutlineCloudUpload,
  HiOutlineHome,
  HiOutlineInformationCircle,
} from 'react-icons/hi';
import * as api from '../services/api';
import UploadCard from '../components/UploadCard';
import AutofillForm from '../components/AutofillForm';

const WIZARD_STORAGE_PREFIX = 'passport-extractor-portal-';

function getWizardStorage() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'upload', title: 'Upload' },
  { id: 'selfie', title: 'Selfie' },
  { id: 'details', title: 'Details' },
  { id: 'success', title: 'Success' },
];

const PROCESSING_STEPS = [
  'Uploading your document set',
  'Reading passport and PAN details',
  'Extracting traveler information',
  'Preparing your registration form',
];

const SUBMISSION_STEPS = [
  'Cooking up your trip',
  'Loading vacation mode',
  'Sorting your travel chaos',
  'Making your passport feel useful',
  'Getting your boarding vibes ready',
];

const EMPTY_FORM_DATA = {
  full_name: '',
  given_name: '',
  surname: '',
  passport_number: '',
  date_of_birth: '',
  date_of_issue: '',
  date_of_expiry: '',
  place_of_birth: '',
  place_of_issue: '',
  passport_address: '',
  pan_number: '',
  contact_number: '',
  email: '',
  meal_preference: '',
};

const DEFAULT_REQUIRED_FORM_FIELDS = {
  contact_number: true,
  email: true,
  meal_preference: true,
};

function normalizeUppercaseRecord(record) {
  const preserveCaseKeys = new Set(['email', 'meal_preference']);
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      typeof value === 'string' && !preserveCaseKeys.has(key) ? value.toUpperCase() : value,
    ])
  );
}

function normalizeExtractedNameFields(record) {
  const fullName = String(record.full_name || '').trim();
  const surname = String(record.surname || '').trim();
  let givenName = String(record.given_name || '').trim();

  if (fullName) {
    const fullParts = fullName.split(/\s+/).filter(Boolean);

    if (!surname && fullParts.length > 1) {
      record.surname = fullParts[fullParts.length - 1];
    }

    const effectiveSurname = String(record.surname || surname || '').trim();
    if (effectiveSurname) {
      const suffixPattern = new RegExp(`\\s+${effectiveSurname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      const derivedGivenName = fullName.replace(suffixPattern, '').trim();
      if (derivedGivenName) {
        givenName = derivedGivenName;
      }
    } else if (fullParts.length > 0) {
      givenName = fullName;
    }
  }

  if (givenName) {
    record.given_name = givenName;
  }

  return record;
}

function extractDriveFileId(value) {
  const input = String(value || '').trim();
  if (!input) return '';

  if (/^[a-zA-Z0-9_-]{20,}$/.test(input) && !input.includes('://')) {
    return input;
  }

  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return '';
}

function resolveDriveMediaUrl(value, fallbackUrl = '', download = false) {
  const fileId = extractDriveFileId(value);
  if (!fileId) {
    return api.resolveMediaUrl(fallbackUrl || String(value || ''));
  }

  return api.resolveMediaUrl(`/api/media/${fileId}${download ? '?download=1' : ''}`);
}


function getFriendlyProcessingError(error) {
  const rawMessage = String(error?.message || error || '').trim();
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes('econnrefused') ||
    normalized.includes('network error') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('server is not available')
  ) {
    return 'The server is not available right now. Please review the details and try again in a moment.';
  }

  if (rawMessage) {
    return rawMessage;
  }

  return 'We could not complete the document check. Please review the details and fill in any missing information.';
}

function dataUrlToFile(dataUrl, name, type, lastModified) {
  if (!dataUrl) return null;
  const [header, data] = dataUrl.split(',');
  if (!header || !data) return null;

  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = type || mimeMatch?.[1] || 'application/octet-stream';
  const binary = window.atob(data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], name || 'upload.jpg', {
    type: mimeType,
    lastModified: lastModified || Date.now(),
  });
}

async function fileToPersistedPayload(file) {
  if (!file) return null;

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  return {
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    dataUrl,
  };
}

function StepGlyph({ stepId }) {
  switch (stepId) {
    case 'welcome':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="stepper-node-icon">
          <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'upload':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="stepper-node-icon">
          <path d="M12 16V7m0 0-3.5 3.5M12 7l3.5 3.5M5 17.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'selfie':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="stepper-node-icon">
          <path d="M8.5 9.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0ZM4.5 19c1.4-2.7 4.1-4 7.5-4s6.1 1.3 7.5 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'details':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="stepper-node-icon">
          <path d="M7 5.5h10M7 10.5h10M7 15.5h6M6 4h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'success':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="stepper-node-icon">
          <path d="m7.5 12 3 3 6-6M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * Portal 404 — shown when slug is invalid or portal is inactive.
 */
function PortalNotFound({ slug }) {
  const navigate = useNavigate();
  return (
    <div className="portal-not-found">
      <motion.div
        className="portal-not-found-card"
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      >
        <div className="portal-not-found-icon">🔍</div>
        <h1>Portal Not Found</h1>
        <p>
          The portal <strong>/{slug}</strong> doesn't exist or is currently inactive.
        </p>
        <button
          type="button"
          className="cta-primary"
          onClick={() => navigate('/')}
        >
          Go Home
        </button>
      </motion.div>
    </div>
  );
}

/**
 * Loading state while fetching portal config.
 */
function PortalLoading() {
  return (
    <div className="portal-loading">
      <motion.div
        className="portal-loading-spinner"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <p>Loading portal...</p>
    </div>
  );
}

const PortalLanding = ({ slugOverride = '', basePathOverride }) => {
  const params = useParams();
  const slug = slugOverride || params.slug || '';
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = basePathOverride !== undefined ? basePathOverride : `/${slug}`;

  // Portal config state
  const [portalConfig, setPortalConfig] = useState(null);
  const [portalLoading, setPortalLoading] = useState(true);
  const [portalError, setPortalError] = useState(false);

  // Fetch portal config on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchPortal() {
      try {
        setPortalLoading(true);
        setPortalError(false);
        const response = await api.default.get(`/portals/${slug}`);
        if (!cancelled && response.data.success) {
          setPortalConfig(response.data.portal);
        } else if (!cancelled) {
          setPortalError(true);
        }
      } catch (err) {
        if (!cancelled) {
          setPortalError(true);
        }
      } finally {
        if (!cancelled) {
          setPortalLoading(false);
        }
      }
    }
    fetchPortal();
    return () => { cancelled = true; };
  }, [slug]);

  // Apply portal theme via CSS custom properties
  useEffect(() => {
    if (!portalConfig?.theme) return;
    const root = document.documentElement;
    root.style.setProperty('--portal-primary', portalConfig.theme.primaryColor || '#6366f1');
    root.style.setProperty('--portal-accent', portalConfig.theme.accentColor || '#f59e0b');
    root.style.setProperty('--portal-hero-overlay', portalConfig.theme.heroOverlayOpacity ?? 0.4);

    return () => {
      root.style.removeProperty('--portal-primary');
      root.style.removeProperty('--portal-accent');
      root.style.removeProperty('--portal-hero-overlay');
    };
  }, [portalConfig]);

  // Wizard storage key unique per portal
  const WIZARD_STORAGE_KEY = `${WIZARD_STORAGE_PREFIX}${slug}`;

  // Determine step from path
  const getStepFromPath = useCallback((path) => {
    const subPath = basePath ? path.replace(basePath, '') || '/' : path || '/';
    switch (subPath) {
      case '/': return 0;
      case '/register': return 1;
      case '/upload': return 1;
      case '/selfie': return 2;
      case '/details': return 3;
      case '/success': return 4;
      default: return 0;
    }
  }, [basePath]);

  const getPathFromStep = useCallback((step) => {
    switch (step) {
      case 0: return basePath || '/';
      case 1: return `${basePath}/upload` || '/upload';
      case 2: return `${basePath}/selfie` || '/selfie';
      case 3: return `${basePath}/details` || '/details';
      case 4: return `${basePath}/success` || '/success';
      default: return basePath || '/';
    }
  }, [basePath]);

  // Load persisted state
  function loadPersistedWizardState() {
    const storage = getWizardStorage();
    const empty = {
      files: { passport_front: null, passport_back: null, pan_card: null, selfie: null },
      formData: EMPTY_FORM_DATA,
      driveLinks: {},
      ocrRawText: '',
      processingError: null,
    };

    if (!storage) return empty;

    try {
      const rawState = storage.getItem(WIZARD_STORAGE_KEY);
      if (!rawState) return empty;

      const parsedState = JSON.parse(rawState);
      const persistedFiles = parsedState.files || {};

      return {
        files: {
          passport_front: persistedFiles.passport_front
            ? dataUrlToFile(persistedFiles.passport_front.dataUrl, persistedFiles.passport_front.name, persistedFiles.passport_front.type, persistedFiles.passport_front.lastModified)
            : null,
          passport_back: persistedFiles.passport_back
            ? dataUrlToFile(persistedFiles.passport_back.dataUrl, persistedFiles.passport_back.name, persistedFiles.passport_back.type, persistedFiles.passport_back.lastModified)
            : null,
          pan_card: persistedFiles.pan_card
            ? dataUrlToFile(persistedFiles.pan_card.dataUrl, persistedFiles.pan_card.name, persistedFiles.pan_card.type, persistedFiles.pan_card.lastModified)
            : null,
          selfie: persistedFiles.selfie
            ? dataUrlToFile(persistedFiles.selfie.dataUrl, persistedFiles.selfie.name, persistedFiles.selfie.type, persistedFiles.selfie.lastModified)
            : null,
        },
        formData: normalizeUppercaseRecord({ ...EMPTY_FORM_DATA, ...(parsedState.formData || {}) }),
        driveLinks: parsedState.driveLinks || {},
        ocrRawText: parsedState.ocrRawText || '',
        processingError: parsedState.processingError || null,
      };
    } catch (error) {
      console.error('Failed to restore saved registration state:', error);
      return empty;
    }
  }

  const [currentStep, setCurrentStep] = useState(getStepFromPath(location.pathname));
  const persistedState = useRef(loadPersistedWizardState()).current;

  useEffect(() => {
    const step = getStepFromPath(location.pathname);
    setCurrentStep(step);
    window.scrollTo(0, 0);
  }, [location.pathname, getStepFromPath]);

  const [isHeroActive, setIsHeroActive] = useState(true);
  const heroSectionRef = useRef(null);
  const [files, setFiles] = useState(persistedState.files);
  const [formData, setFormData] = useState(persistedState.formData);
  const [formErrors, setFormErrors] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState(persistedState.processingError);
  const hasSuccessfulUploads =
    persistedState.driveLinks?.passport_front_id &&
    persistedState.driveLinks?.passport_back_id &&
    persistedState.driveLinks?.passport_merged_id &&
    persistedState.driveLinks?.pan_card_id;

  const [documentProcessingState, setDocumentProcessingState] = useState(
    persistedState.processingError
      ? 'error'
      : hasSuccessfulUploads
        ? 'success'
        : 'idle'
  );
  const [isAwaitingProcessingResult, setIsAwaitingProcessingResult] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ocrRawText, setOcrRawText] = useState(persistedState.ocrRawText);
  const [driveLinks, setDriveLinks] = useState(persistedState.driveLinks);
  const [registrationResult, setRegistrationResult] = useState(null);
  const [processingStep, setProcessingStep] = useState(0);
  const [processingPulse, setProcessingPulse] = useState(0);
  const [submissionStep, setSubmissionStep] = useState(0);
  const processingPromiseRef = useRef(null);

  useEffect(() => {
    if (currentStep === 4 && !registrationResult) {
      navigate(getPathFromStep(0));
    }
  }, [currentStep, registrationResult, navigate, getPathFromStep]);

  const handleFileSelect = useCallback((fieldName, file) => {
    setFiles((prev) => ({ ...prev, [fieldName]: file }));

    if (fieldName !== 'selfie') {
      processingPromiseRef.current = null;
      setDocumentProcessingState('idle');
      setProcessingError(null);
      setDriveLinks({});
      setOcrRawText('');
    }
  }, []);

  // Processing timer effects
  useEffect(() => {
    if (!isProcessing) {
      setProcessingStep(0);
      setProcessingPulse(0);
      return undefined;
    }
    setProcessingStep(0);
    setProcessingPulse(8);
    const stepTimer = window.setInterval(() => {
      setProcessingStep((prev) => Math.min(prev + 1, PROCESSING_STEPS.length - 1));
    }, 1800);
    const pulseTimer = window.setInterval(() => {
      setProcessingPulse((prev) => {
        if (prev < 42) return prev + 1;
        if (prev < 72) return prev + 0.65;
        if (prev < 88) return prev + 0.35;
        return Math.min(prev + 0.15, 96);
      });
    }, 90);
    return () => {
      window.clearInterval(stepTimer);
      window.clearInterval(pulseTimer);
    };
  }, [isProcessing]);

  useEffect(() => {
    if (!isSubmitting) {
      setSubmissionStep(0);
      return undefined;
    }
    const submissionTimer = window.setInterval(() => {
      setSubmissionStep((prev) => (prev + 1) % SUBMISSION_STEPS.length);
    }, 1700);
    return () => { window.clearInterval(submissionTimer); };
  }, [isSubmitting]);

  // Hero scroll observer
  useEffect(() => {
    if (currentStep !== 0) {
      setIsHeroActive(false);
      return undefined;
    }
    const updateHeroState = () => {
      const heroSection = heroSectionRef.current;
      if (!heroSection) {
        setIsHeroActive(true);
        return;
      }
      const { bottom } = heroSection.getBoundingClientRect();
      setIsHeroActive(bottom > window.innerHeight);
    };
    updateHeroState();
    window.addEventListener('scroll', updateHeroState, { passive: true });
    window.addEventListener('resize', updateHeroState);
    return () => {
      window.removeEventListener('scroll', updateHeroState);
      window.removeEventListener('resize', updateHeroState);
    };
  }, [currentStep]);

  // Persist wizard state
  useEffect(() => {
    const storage = getWizardStorage();
    if (!storage) return undefined;
    let cancelled = false;
    const persistState = async () => {
      const serializedEntries = await Promise.all(
        Object.entries(files).map(async ([key, file]) => [key, await fileToPersistedPayload(file)])
      );
      if (cancelled) return;
      storage.setItem(
        WIZARD_STORAGE_KEY,
        JSON.stringify({
          files: Object.fromEntries(serializedEntries),
          formData,
          driveLinks,
          ocrRawText,
          processingError,
        })
      );
    };
    persistState().catch((error) => {
      console.error('Failed to persist registration state:', error);
    });
    return () => { cancelled = true; };
  }, [files, formData, driveLinks, ocrRawText, processingError, WIZARD_STORAGE_KEY]);

  // Determine document upload fields from portal config
  const processingDocFields = portalConfig?.requiredDocuments?.filter(d => d.key !== 'selfie') || [
    { key: 'passport_front', label: 'Passport Front', required: true, helperText: 'Ensure the photo page is clear and glare-free.' },
    { key: 'passport_back', label: 'Passport Back', required: true, helperText: 'Upload the address page from your passport.' },
    { key: 'pan_card', label: 'PAN Card', required: true, helperText: 'Capture the full card within the frame.' },
  ];

  const processingRequiredDocFields = processingDocFields.filter((doc) => doc.required !== false);
  const missingRequiredProcessingDocs = processingRequiredDocFields
    .filter((doc) => !files[doc.key])
    .map((doc) => doc.label || doc.key);
  const canProcessDocumentsForAnalysis = missingRequiredProcessingDocs.length === 0;

  const processDocuments = useCallback(async () => {
    if (!canProcessDocumentsForAnalysis) {
      toast.error(`Please upload the required documents: ${missingRequiredProcessingDocs.join(', ')}`);
      return { success: false };
    }
    if (documentProcessingState === 'success') {
      return { success: true };
    }
    if (processingPromiseRef.current) {
      return processingPromiseRef.current;
    }

    setIsProcessing(true);
    setProcessingError(null);
    setDocumentProcessingState('running');

    const processingTask = (async () => {
      try {
        await api.checkHealth(4000);
        const hasPassportPair = Boolean(files.passport_front && files.passport_back);
        const hasPan = Boolean(files.pan_card);

        if (!hasPassportPair && !hasPan) {
          setProcessingPulse(100);
          setDocumentProcessingState('success');
          toast.success('No extractable documents were uploaded. You can continue manually.');
          return { success: true, skipped: true };
        }

        let passportResult = null;
        if (hasPassportPair) {
          passportResult = await api.extractPassport(files.passport_front, files.passport_back, slug);
          if (!passportResult.success) {
            throw new Error(passportResult.error || 'Passport extraction failed');
          }

          setOcrRawText(passportResult.ocrText || '');
          setDriveLinks((prev) => ({
            ...prev,
            passport_front_id: passportResult.files?.passport_front?.id,
            passport_back_id: passportResult.files?.passport_back?.id,
            passport_merged_id: passportResult.files?.passport_merged?.id,
            passport_front: passportResult.files?.passport_front?.link,
            passport_back: passportResult.files?.passport_back?.link,
            passport_merged: passportResult.files?.passport_merged?.link,
          }));
        }

        let panResult = null;
        if (hasPan) {
          const extractedFullName = passportResult?.data?.full_name || formData.full_name || '';
          panResult = await api.extractPan(files.pan_card, extractedFullName, slug);
          if (!panResult.success) {
            throw new Error(panResult.error || 'PAN extraction failed');
          }

          setDriveLinks((prev) => ({
            ...prev,
            pan_card_id: panResult.file?.id,
            pan_card: panResult.file?.link,
          }));
        }

        const extractedData = normalizeUppercaseRecord(
          normalizeExtractedNameFields({
            ...(passportResult?.data || {}),
            pan_number: panResult?.data?.pan_number || '',
          })
        );

        if (Object.keys(extractedData).length > 0) {
          setFormData((prev) => ({ ...prev, ...extractedData }));
        }

        if (panResult?.ocrText) {
          setOcrRawText((prev) => (
            prev ? `${prev}\n\n--- PAN OCR ---\n\n${panResult.ocrText || ''}` : panResult.ocrText || ''
          ));
        }

        setProcessingPulse(100);
        setDocumentProcessingState('success');
        toast.success('Documents processed successfully!');
        return { success: true };
      } catch (error) {
        console.error('OCR processing error:', error);
        setProcessingPulse(100);
        const friendlyError = getFriendlyProcessingError(error);
        setProcessingError(friendlyError);
        toast.error(friendlyError);
        setDocumentProcessingState('error');
        return { success: false, error };
      } finally {
        setIsProcessing(false);
        processingPromiseRef.current = null;
      }
    })();

    processingPromiseRef.current = processingTask;
    return processingTask;
  }, [
    canProcessDocumentsForAnalysis,
    documentProcessingState,
    files.pan_card,
    files.passport_back,
    files.passport_front,
    formData.full_name,
    missingRequiredProcessingDocs,
    slug,
  ]);

  // Dynamic email validation based on portal's allowedEmailDomains
  const validateForm = () => {
    const errors = {};
    const requiredFormFields = {
      ...DEFAULT_REQUIRED_FORM_FIELDS,
      ...(portalConfig?.requiredFormFields || {}),
    };
    if (!formData.full_name?.trim()) errors.full_name = 'Full name is required';
    if (!formData.passport_number?.trim()) errors.passport_number = 'Passport number is required';
    if (requiredFormFields.contact_number && !formData.contact_number?.trim()) {
      errors.contact_number = 'Contact number is required';
    } else if (formData.contact_number?.trim()) {
      const contactDigits = formData.contact_number.replace(/\D/g, '');
      const isLocalNumber = contactDigits.length === 10;
      const isCountryCodeNumber = contactDigits.length === 12 && contactDigits.startsWith('91');
      if (!isLocalNumber && !isCountryCodeNumber) {
        errors.contact_number = 'Enter a valid contact number';
      }
    }
    if (requiredFormFields.email && !formData.email?.trim()) {
      errors.email = 'Email is required';
    } else if (formData.email?.trim()) {
      const emailDomains = portalConfig?.allowedEmailDomains || [];
      if (emailDomains.length > 0) {
        const emailDomain = formData.email.trim().split('@')[1]?.toLowerCase();
        const isAllowed = emailDomains.some(d => d.toLowerCase() === emailDomain);
        if (!isAllowed) {
          errors.email = `Email must be from: ${emailDomains.join(', ')}`;
        }
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = 'Invalid email format';
      }
    }
    if (requiredFormFields.meal_preference && !formData.meal_preference?.trim()) {
      errors.meal_preference = 'Meal preference is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setIsSubmitting(true);
    try {
      toast.loading('Submitting registration...', { id: 'submit' });
      const submissionData = {
        ...normalizeUppercaseRecord(formData),
        portalSlug: slug,
        passportFrontId: driveLinks.passport_front_id || '',
        passportBackId: driveLinks.passport_back_id || '',
        passportMergedId: driveLinks.passport_merged_id || '',
        panCardId: driveLinks.pan_card_id || '',
        passportFrontLink: driveLinks.passport_front || '',
        passportBackLink: driveLinks.passport_back || '',
        passportMergedLink: driveLinks.passport_merged || '',
        panCardLink: driveLinks.pan_card || '',
        ocrRawText,
      };

      const result = await api.submitRegistration(submissionData, files.selfie);
      if (!result.success) throw new Error(result.error || 'Submission failed');

      setRegistrationResult(result);
      getWizardStorage()?.removeItem(WIZARD_STORAGE_KEY);
      toast.success('Registration submitted successfully!', { id: 'submit' });
      goToStep(4);
    } catch (error) {
      console.error('Submission error:', error);
      toast.error(`Submission failed: ${error.message}`, { id: 'submit' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToStep = (step) => {
    navigate(getPathFromStep(step));
  };

  // Determine required document upload fields from portal config
  const docFields = portalConfig?.requiredDocuments?.filter(d => d.key !== 'selfie') || [
    { key: 'passport_front', label: 'Passport Front', required: true, helperText: 'Ensure the photo page is clear and glare-free.' },
    { key: 'passport_back', label: 'Passport Back', required: true, helperText: 'Upload the address page from your passport.' },
    { key: 'pan_card', label: 'PAN Card', required: true, helperText: 'Capture the full card within the frame.' },
  ];

  const selfieDoc = portalConfig?.requiredDocuments?.find(d => d.key === 'selfie') || {
    key: 'selfie', label: 'Profile Photo', required: true, helperText: 'Look straight into the camera in good lighting.',
  };
  const isSelfieRequired = selfieDoc.required !== false;

  // ─── Render States ───────────────────────────────────────────

  if (portalLoading) return <PortalLoading />;
  if (portalError || !portalConfig) return <PortalNotFound slug={slug} />;

  const heroType = portalConfig.hero?.type || 'image';
  const heroUrl = resolveDriveMediaUrl(
    portalConfig.hero?.url || portalConfig.hero?.driveFileId || '',
    '',
    heroType === 'video'
  );
  const portalTitle = portalConfig.title || 'Welcome';
  const portalSubtitle = portalConfig.subtitle || '';
  const travelDatesDisplay = portalConfig.travelDates?.displayText || '';
  const travelStart = portalConfig.travelDates?.start || '';
  const travelEnd = portalConfig.travelDates?.end || '';

  // Format dates for display
  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  }

  const startDateLabel = formatDateShort(travelStart)
    || travelDatesDisplay.split(/\s+-\s+/)[0]?.trim()
    || '';

  const endDateLabel = formatDateShort(travelEnd)
    || travelDatesDisplay.split(/\s+-\s+/)[1]?.trim()
    || '';
  const logoUrl = resolveDriveMediaUrl(portalConfig.logo?.url || portalConfig.logo?.driveFileId || '');

  return (
    <div
      className={`page-shell portal-themed${currentStep === 0 ? ' is-home' : ''}`}
      style={{
        '--portal-primary': portalConfig.theme?.primaryColor || '#6366f1',
        '--portal-accent': portalConfig.theme?.accentColor || '#f59e0b',
      }}
    >
      <main className={`page-main${currentStep === 0 ? ' is-home' : ''}`}>
        <AnimatePresence mode="wait">
          {currentStep === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <section ref={heroSectionRef} className="hero-section">
                {logoUrl && (
                  <div className="portal-logo-bar hero-logo-overlay">
                    <img src={logoUrl} alt="Portal logo" className="portal-logo-img" />
                  </div>
                )}
                {heroType === 'video' && heroUrl ? (
                  <video
                    className="hero-video"
                    src={heroUrl}
                    autoPlay
                    muted
                    loop
                    preload="auto"
                    playsInline
                    aria-label="Portal hero background"
                  />
                ) : heroUrl ? (
                  <img
                    className="hero-video"
                    src={heroUrl}
                    alt="Portal hero background"
                    style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                  />
                ) : (
                  <div className="hero-video hero-gradient-fallback" />
                )}
                <div
                  className="hero-overlay"
                  style={{ opacity: portalConfig.theme?.heroOverlayOpacity ?? 0.4 }}
                />
                <motion.div
                  className="hero-content"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: { staggerChildren: 0.15, delayChildren: 0.6 },
                    },
                  }}
                >
                  <motion.h1
                    variants={{
                      hidden: { opacity: 0, y: 30 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                  >
                    {portalTitle}
                  </motion.h1>
                  {portalSubtitle && (
                    <motion.p
                      className="hero-subtitle"
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: { opacity: 1, y: 0 },
                      }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    >
                      {portalSubtitle}
                    </motion.p>
                  )}
                </motion.div>
              </section>

              {/* Highlights */}
              {portalConfig.highlights && portalConfig.highlights.length > 0 && (
                <section className="portal-highlights">
                  <div className="portal-highlights-grid">
                    {portalConfig.highlights.map((h, idx) => (
                      <motion.div
                        key={h.id || idx}
                        className="portal-highlight-card"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.1 }}
                      >
                        {h.image && <img src={h.image} alt={h.title} className="portal-highlight-img" />}
                        <div className="portal-highlight-body">
                          {h.label && <span className="portal-highlight-label">{h.label}</span>}
                          <h3>{h.title}</h3>
                          {h.description && <p>{h.description}</p>}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          )}

          {currentStep > 0 && (
            <motion.div
              key="wizard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="wizard-shell"
            >
              <div className="stepper">
                {STEPS.map((step, idx) => {
                  const isComplete = currentStep > idx;
                  const isActive = currentStep === idx;
                  return (
                    <React.Fragment key={step.id}>
                      <div className="stepper-item">
                        <div className={`stepper-node${isComplete ? ' is-complete' : ''}${isActive ? ' is-active' : ''}`}>
                          <StepGlyph stepId={step.id} />
                        </div>
                        <span className={`stepper-label${isActive ? ' is-active' : ''}${isComplete ? ' is-complete' : ''}`}>
                          {step.title}
                        </span>
                      </div>
                      {idx < STEPS.length - 1 && (
                        <div className={`stepper-line${currentStep > idx ? ' is-complete' : ''}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="wizard-card">
                {/* Step 1: Upload Documents */}
                {currentStep === 1 && (
                  <div className="space-y-8">
                    <div className="wizard-header">
                      <h2>Verify Identity</h2>
                      <p>Please upload your documents to start the extraction.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      {docFields.map((doc) => (
                        <UploadCard
                          key={doc.key}
                          label={doc.label}
                          icon={doc.key === 'passport_front' ? 'Passport' : doc.key === 'passport_back' ? 'Address' : 'PAN'}
                          file={files[doc.key]}
                          onFileSelect={handleFileSelect}
                          fieldName={doc.key}
                          helperText={doc.helperText}
                        />
                      ))}
                    </div>

                    <div className="wizard-actions">
                      <button
                        type="button"
                        onClick={async () => {
                          void processDocuments();
                          goToStep(2);
                        }}
                        disabled={isProcessing || !canProcessDocumentsForAnalysis}
                        className="cta-primary cta-primary-wide"
                      >
                        Analyze Documents
                        <HiOutlineArrowRight />
                      </button>
                      <button type="button" onClick={() => goToStep(0)} className="link-button">
                        Go Back
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Selfie */}
                {currentStep === 2 && (
                  <div className="space-y-8">
                    <div className="wizard-header">
                      <h2>Upload Your Selfie</h2>
                      <p>Add your profile photo before moving to the verification screen.</p>
                    </div>

                    <div className="selfie-panel">
                      <div className="selfie-panel-title">
                        <HiOutlineInformationCircle />
                        <span>{selfieDoc.label}</span>
                      </div>
                      <p className="processing-selfie-copy">
                        Please upload a clear selfie in good lighting. We&apos;ll use it for the
                        final registration record.
                      </p>
                      <UploadCard
                        label={selfieDoc.label}
                        icon="Selfie"
                        file={files.selfie}
                        onFileSelect={handleFileSelect}
                        fieldName="selfie"
                        helperText={selfieDoc.helperText}
                      />
                    </div>

                    <div className="wizard-actions">
                      <button
                        type="button"
                        onClick={async () => {
                          if (isSelfieRequired && !files.selfie) {
                            toast.error('Please upload your selfie to continue');
                            return;
                          }
                          if (documentProcessingState === 'success' || documentProcessingState === 'error') {
                            goToStep(3);
                            return;
                          }
                          setIsAwaitingProcessingResult(true);
                          try {
                            const result = await processDocuments();
                            if (result?.success) {
                              goToStep(3);
                            }
                          } finally {
                            setIsAwaitingProcessingResult(false);
                          }
                        }}
                        disabled={isAwaitingProcessingResult || (isSelfieRequired && !files.selfie)}
                        className="cta-primary cta-primary-wide"
                      >
                        {isAwaitingProcessingResult
                          ? 'Processing Documents...'
                          : documentProcessingState === 'success'
                            ? 'Continue to Verify Details'
                            : isSelfieRequired
                              ? 'Submit Selfie & Continue'
                              : 'Continue to Verify Details'}
                        {!isAwaitingProcessingResult && <HiOutlineArrowRight />}
                      </button>
                      <button type="button" onClick={() => goToStep(1)} className="link-button">
                        Back to Uploads
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Details */}
                {currentStep === 3 && (
                  <div className="space-y-8">
                    <div className="wizard-header">
                      <h2>Verify Details</h2>
                      <p>Review each document section and confirm the extracted information.</p>
                    </div>

                    {processingError && (
                      <div className="wizard-alert">
                        <HiOutlineInformationCircle />
                        <span>{processingError}</span>
                      </div>
                    )}

                    <AutofillForm
                      formData={formData}
                      onChange={setFormData}
                      errors={formErrors}
                      selfieFile={files.selfie}
                      files={files}
                      allowedEmailDomains={portalConfig?.allowedEmailDomains || []}
                      requiredFormFields={portalConfig?.requiredFormFields || DEFAULT_REQUIRED_FORM_FIELDS}
                    />

                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="cta-primary cta-primary-wide"
                    >
                      {isSubmitting ? 'Finalizing Registration...' : 'Complete Registration'}
                    </button>
                  </div>
                )}

                {/* Step 4: Success */}
                {currentStep === 4 && registrationResult && (
                  <div className="success-panel success-panel-cinematic">
                    {portalConfig.hero?.type === 'video' && portalConfig.hero?.url ? (
                      <video
                        className="success-panel-video"
                        src={api.resolveMediaUrl(portalConfig.hero.url)}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                        aria-hidden="true"
                      />
                    ) : (
                      <div
                        className="success-panel-video hero-gradient-fallback"
                        style={{
                          background: `linear-gradient(135deg, ${portalConfig.theme?.primaryColor || '#6366f1'}, ${portalConfig.theme?.accentColor || '#f59e0b'})`,
                        }}
                      />
                    )}
                    <div className="success-panel-overlay" />
                    <motion.div
                      className="success-panel-content"
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                    >
                      <motion.div
                        className="success-icon"
                        initial={{ scale: 0.82, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 180, damping: 18, delay: 0.12 }}
                      >
                        <HiOutlineCheckCircle />
                      </motion.div>
                      <div>
                        <span className="success-kicker">Registration Complete</span>
                        <h2>All Set!</h2>
                        <p>Your trip is locked in and the celebration has officially begun.</p>
                        <div className="success-ref">Ref: {registrationResult.registrationId}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          getWizardStorage()?.removeItem(WIZARD_STORAGE_KEY);
                          window.location.href = `/${slug}`;
                        }}
                        className="cta-secondary success-panel-button"
                      >
                        Start New Registration
                      </button>
                    </motion.div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating CTA on welcome step */}
      {currentStep === 0 && (
        <motion.div
          className="floating-home-cta"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 1.5 }}
        >
          {(startDateLabel || endDateLabel) && (
            <div className="floating-home-cta-trip">
              <span>{startDateLabel}</span>
              <div className="floating-home-cta-route" aria-hidden="true">
                <span className="floating-home-cta-line" />
                <span className="floating-home-cta-plane" role="img" aria-label="plane">
                  ✈︎
                </span>
                <span className="floating-home-cta-line" />
              </div>
              <span>{endDateLabel}</span>
            </div>
          )}
          <button
            type="button"
            className={`cta-primary floating-home-cta-button${isHeroActive ? ' is-on-hero' : ' is-on-light'}`}
            onClick={() => goToStep(1)}
          >
            Start Registration
            <HiOutlineArrowRight />
          </button>
        </motion.div>
      )}

      {/* Mobile nav */}
      {currentStep > 0 && (
        <nav className="mobile-nav">
          <button
            type="button"
            className={`mobile-nav-item${currentStep === 0 ? ' is-active' : ''}`}
            onClick={() => goToStep(0)}
          >
            <HiOutlineHome />
            <span>Home</span>
          </button>
          <button
            type="button"
            className={`mobile-nav-item${currentStep === 1 ? ' is-active' : ''}`}
            onClick={() => goToStep(1)}
          >
            <HiOutlineCloudUpload />
            <span>Uploads</span>
          </button>
          <button
            type="button"
            className={`mobile-nav-item${currentStep === 2 ? ' is-active' : ''}`}
            onClick={() => goToStep(files.passport_front || files.passport_back || files.pan_card ? 2 : 1)}
          >
            <HiOutlineInformationCircle />
            <span>Selfie</span>
          </button>
          <button
            type="button"
            className={`mobile-nav-item${currentStep >= 3 ? ' is-active' : ''}`}
            onClick={() =>
              goToStep(files.selfie ? 3 : files.passport_front || files.passport_back || files.pan_card ? 2 : 1)
            }
          >
            <HiOutlineCheckCircle />
            <span>Review</span>
          </button>
        </nav>
      )}

      {/* Processing overlay */}
      <AnimatePresence>
        {isProcessing && isAwaitingProcessingResult && (
          <motion.div
            className="processing-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="processing-modal"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            >
              <div className="processing-copy">
                <span className="processing-kicker">Analyzing Documents</span>
                <h3>We&apos;re preparing your details</h3>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={PROCESSING_STEPS[processingStep]}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                  >
                    {PROCESSING_STEPS[processingStep]}
                  </motion.p>
                </AnimatePresence>
              </div>

              <div className="processing-progress">
                <div
                  className="processing-progress-bar"
                  style={{ width: `${Math.max(12, processingPulse)}%` }}
                />
              </div>

              <div className="processing-dots" aria-hidden="true">
                {[0, 1, 2].map((dot) => (
                  <motion.span
                    key={dot}
                    animate={{ y: [0, -8, 0], opacity: [0.35, 1, 0.35] }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: dot * 0.18,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {isSubmitting && (
          <motion.div
            className="processing-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="processing-modal processing-modal-submit"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            >
              <div className="submission-orbit" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>

              <div className="processing-copy">
                <span className="processing-kicker">Final Submission</span>
                <h3>We&apos;re sealing your trip</h3>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={SUBMISSION_STEPS[submissionStep]}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                  >
                    {SUBMISSION_STEPS[submissionStep]}
                  </motion.p>
                </AnimatePresence>
              </div>

              <div className="processing-dots" aria-hidden="true">
                {[0, 1, 2].map((dot) => (
                  <motion.span
                    key={dot}
                    animate={{ y: [0, -8, 0], opacity: [0.35, 1, 0.35] }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut', delay: dot * 0.18 }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PortalLanding;
