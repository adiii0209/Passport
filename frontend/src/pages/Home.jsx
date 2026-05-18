import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  HiOutlineArrowRight,
  HiOutlineCalendar,
  HiOutlineCheckCircle,
  HiOutlineClipboardList,
  HiOutlineCloudUpload,
  HiOutlineHome,
  HiOutlineInformationCircle,
  HiOutlineLocationMarker,
  HiOutlineOfficeBuilding,
  HiOutlineSupport,
} from 'react-icons/hi';
import * as api from '../services/api';
import UploadCard from '../components/UploadCard';
import AutofillForm from '../components/AutofillForm';
import itineraryImage from '../assets/itinerary.png';

const WIZARD_STORAGE_KEY = 'passport-extractor-wizard-v1';

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

const HIGHLIGHTS = [
  {
    id: 'hotel',
    title: 'Bayview Hotel Langkawi',
    label: 'Accommodation',
    description:
      'Experience premium hospitality with panoramic sea views and conference-ready comfort for the retreat.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB-bi7fd8YSJZ1_caDbUVZrjMTeXb3z07yixprODO0XlBKej7C0iQlwVieqCNhByrU2vpbkfvKKmo3YY0YW1Oa8l1GVVAzlTHfVstC97a40MTTzT1tfqmkL-xoizJeAEnPPLI8-lWKDF-eoz-e7AvEFXopN1OvAll1h4g50TJt12lLHFWIXJ-P-zyWEoyrkAy0G4e2hT5jBaxmvAvpJz8mu7gpDrQTzpO7Q4hEvSCi_707bRXIsopq_-jlr5UBhJrpFGMr3DlVq_sQ',
  },
  {
    id: 'schedule',
    title: 'July 3 - July 5',
    label: 'Schedule',
    description: 'Three days of unlimited fun and island downtime.',
  },
  {
    id: 'travel',
    title: 'Round-trip with IndiGo',
    label: 'Travel',
    description: 'Direct corporate travel from Bengaluru (BLR) to Langkawi (LGK).',
  },
];

const PROCESSING_STEPS = [
  'Uploading your document set',
  'Reading passport and PAN details',
  'Extracting traveler information',
  'Preparing your registration form',
];

const PROCESSING_IMAGES = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB-_ZIb6bg9RAmKVncjobLSwnuTMwulY9x71X_9RSaVll5Ctvw4S3taAHz8hM-DUCmXlap1itqbE_tq7l5XX2tCr400Hsuz7QDqMJi17N-9oP14Z-vGGbIAwaZXst0toHUStjuB5dDmOwlNMfOlrc4Yn0xrkj91YyM7i2tZcpchj53CDJoJa42_QrzgAAAuwKoe3ymLwn66wND7C2canWUrOKIeHsfZ2c-x4cSSRLqFvsl28Qxqbv-v66EE77Z1QpFS80qLH1Sujlg',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB-bi7fd8YSJZ1_caDbUVZrjMTeXb3z07yixprODO0XlBKej7C0iQlwVieqCNhByrU2vpbkfvKKmo3YY0YW1Oa8l1GVVAzlTHfVstC97a40MTTzT1tfqmkL-xoizJeAEnPPLI8-lWKDF-eoz-e7AvEFXopN1OvAll1h4g50TJt12lLHFWIXJ-P-zyWEoyrkAy0G4e2hT5jBaxmvAvpJz8mu7gpDrQTzpO7Q4hEvSCi_707bRXIsopq_-jlr5UBhJrpFGMr3DlVq_sQ',
  'https://commons.wikimedia.org/wiki/Special:FilePath/Langkawi%20Sky%20Bridge.jpg',
];

const EMPTY_FILES = {
  passport_front: null,
  passport_back: null,
  pan_card: null,
  selfie: null,
};

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

function getFriendlyProcessingError(error) {
  const rawMessage = String(error?.message || error || '').toLowerCase();

  if (
    rawMessage.includes('econnrefused') ||
    rawMessage.includes('network error') ||
    rawMessage.includes('failed to fetch') ||
    rawMessage.includes('server is not available')
  ) {
    return 'The server is not available right now. Please review the details and try again in a moment.';
  }

  if (rawMessage.includes('passport')) {
    return 'We could not read the passport clearly. Please review the details and correct any missing fields.';
  }

  if (rawMessage.includes('pan')) {
    return 'We could not read the PAN card clearly. Please review the details and correct any missing fields.';
  }

  if (rawMessage.includes('network') || rawMessage.includes('timeout')) {
    return 'We ran into a connection issue while checking your documents. Please review the details and try again if needed.';
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

function loadPersistedWizardState() {
  const storage = getWizardStorage();

  if (!storage) {
    return {
      files: EMPTY_FILES,
      formData: EMPTY_FORM_DATA,
      driveLinks: {},
      ocrRawText: '',
      processingError: null,
    };
  }

  try {
    const rawState = storage.getItem(WIZARD_STORAGE_KEY);
    if (!rawState) {
      return {
        files: EMPTY_FILES,
        formData: EMPTY_FORM_DATA,
        driveLinks: {},
        ocrRawText: '',
        processingError: null,
      };
    }

    const parsedState = JSON.parse(rawState);
    const persistedFiles = parsedState.files || {};

    return {
      files: {
        passport_front: persistedFiles.passport_front
          ? dataUrlToFile(
              persistedFiles.passport_front.dataUrl,
              persistedFiles.passport_front.name,
              persistedFiles.passport_front.type,
              persistedFiles.passport_front.lastModified
            )
          : null,
        passport_back: persistedFiles.passport_back
          ? dataUrlToFile(
              persistedFiles.passport_back.dataUrl,
              persistedFiles.passport_back.name,
              persistedFiles.passport_back.type,
              persistedFiles.passport_back.lastModified
            )
          : null,
        pan_card: persistedFiles.pan_card
          ? dataUrlToFile(
              persistedFiles.pan_card.dataUrl,
              persistedFiles.pan_card.name,
              persistedFiles.pan_card.type,
              persistedFiles.pan_card.lastModified
            )
          : null,
        selfie: persistedFiles.selfie
          ? dataUrlToFile(
              persistedFiles.selfie.dataUrl,
              persistedFiles.selfie.name,
              persistedFiles.selfie.type,
              persistedFiles.selfie.lastModified
            )
          : null,
      },
      formData: normalizeUppercaseRecord({ ...EMPTY_FORM_DATA, ...(parsedState.formData || {}) }),
      driveLinks: parsedState.driveLinks || {},
      ocrRawText: parsedState.ocrRawText || '',
      processingError: parsedState.processingError || null,
    };
  } catch (error) {
    console.error('Failed to restore saved registration state:', error);
    return {
      files: EMPTY_FILES,
      formData: EMPTY_FORM_DATA,
      driveLinks: {},
      ocrRawText: '',
      processingError: null,
    };
  }
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

const Home = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const persistedState = useRef(loadPersistedWizardState()).current;

  const getStepFromPath = useCallback((path) => {
    switch (path) {
      case '/': return 0;
      case '/upload': return 1;
      case '/selfie': return 2;
      case '/details': return 3;
      case '/success': return 4;
      default: return 0;
    }
  }, []);

  const getPathFromStep = (step) => {
    switch (step) {
      case 0: return '/';
      case 1: return '/upload';
      case 2: return '/selfie';
      case 3: return '/details';
      case 4: return '/success';
      default: return '/';
    }
  };

  const [currentStep, setCurrentStep] = useState(getStepFromPath(location.pathname));

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
  const [documentProcessingState, setDocumentProcessingState] = useState(
    persistedState.processingError
      ? 'error'
      : persistedState.ocrRawText || persistedState.driveLinks?.passport_front_id || persistedState.driveLinks?.pan_card_id
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
  const [isItineraryOpen, setIsItineraryOpen] = useState(false);
  const processingPromiseRef = useRef(null);

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

    return () => {
      cancelled = true;
    };
  }, [files, formData, driveLinks, ocrRawText, processingError]);

  const processDocuments = useCallback(async () => {
    if (!files.passport_front || !files.passport_back) {
      toast.error('Please upload both passport front and back images');
      return { success: false };
    }
    if (!files.pan_card) {
      toast.error('Please upload your PAN card image');
      return { success: false };
    }

    if (documentProcessingState === 'success') {
      return { success: true };
    }

    if (documentProcessingState === 'error' && !processingPromiseRef.current) {
      return { success: false };
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

        const passportResult = await api.extractPassport(files.passport_front, files.passport_back);

        if (!passportResult.success) {
          throw new Error(passportResult.error || 'Passport extraction failed');
        }

        setOcrRawText(passportResult.ocrText || '');
        setDriveLinks((prev) => ({
          ...prev,
          passport_front_id: passportResult.files?.passport_front?.id,
          passport_back_id: passportResult.files?.passport_back?.id,
          passport_front: passportResult.files?.passport_front?.link,
          passport_back: passportResult.files?.passport_back?.link,
        }));

        const extractedFullName = passportResult.data?.full_name || '';
        const panResult = await api.extractPan(files.pan_card, extractedFullName);

        if (!panResult.success) {
          throw new Error(panResult.error || 'PAN extraction failed');
        }

        setDriveLinks((prev) => ({
          ...prev,
          pan_card_id: panResult.file?.id,
          pan_card: panResult.file?.link,
        }));

        const extractedData = normalizeUppercaseRecord(
          normalizeExtractedNameFields({
            ...(passportResult.data || {}),
            pan_number: panResult.data?.pan_number || '',
          })
        );

        setFormData((prev) => ({
          ...prev,
          ...extractedData,
        }));

        setOcrRawText((prev) => prev + '\n\n--- PAN OCR ---\n\n' + (panResult.ocrText || ''));
        setProcessingPulse(100);
        setDocumentProcessingState('success');
        toast.success('Documents processed successfully!');
        return { success: true };
      } catch (error) {
        console.error('OCR processing error:', error);
        setProcessingPulse(100);
        setProcessingError(getFriendlyProcessingError(error));
        setDocumentProcessingState('error');
        return { success: false, error };
      } finally {
        setIsProcessing(false);
        processingPromiseRef.current = null;
      }
    })();

    processingPromiseRef.current = processingTask;
    return processingTask;
  }, [documentProcessingState, files.pan_card, files.passport_back, files.passport_front]);

  const validateForm = () => {
    const errors = {};
    if (!formData.full_name?.trim()) errors.full_name = 'Full name is required';
    if (!formData.passport_number?.trim()) errors.passport_number = 'Passport number is required';
    if (!formData.contact_number?.trim()) {
      errors.contact_number = 'Contact number is required';
    } else {
      const contactDigits = formData.contact_number.replace(/\D/g, '');
      const isLocalNumber = contactDigits.length === 10;
      const isCountryCodeNumber = contactDigits.length === 12 && contactDigits.startsWith('91');
      if (!isLocalNumber && !isCountryCodeNumber) {
        errors.contact_number = 'Enter a valid contact number';
      }
    }
    if (!formData.email?.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@axxela\.in$/i.test(formData.email.trim())) {
      errors.email = 'Enter your company mail';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    if (!formData.meal_preference?.trim()) errors.meal_preference = 'Meal preference is required';
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
        passportFrontId: driveLinks.passport_front_id || '',
        passportBackId: driveLinks.passport_back_id || '',
        panCardId: driveLinks.pan_card_id || '',
        passportFrontLink: driveLinks.passport_front || '',
        passportBackLink: driveLinks.passport_back || '',
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

  return (
    <div className={`page-shell${currentStep === 0 ? ' is-home' : ''}`}>
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
                <video
                  className="hero-video"
                  src="/vid.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  aria-label="Langkawi fire show background"
                />
                <div className="hero-overlay" />
                <motion.div
                  className="hero-content"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: { staggerChildren: 0.15, delayChildren: 1.0 },
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
                    Welcome to Langkawi
                  </motion.h1>
                  <motion.p
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  >
                    Your 3-day itinerary from Bengaluru to the Jewel of Kedah is ready.
                    Experience the right balance of strategic planning and tropical calm.
                  </motion.p>
                </motion.div>
              </section>

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
                        <div
                          className={`stepper-node${isComplete ? ' is-complete' : ''}${isActive ? ' is-active' : ''}`}
                        >
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
                {currentStep === 1 && (
                  <div className="space-y-8">
                    <div className="wizard-header">
                      <h2>Verify Identity</h2>
                      <p>Please upload your documents to start the extraction.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <UploadCard
                        label="Passport Front"
                        icon="Passport"
                        file={files.passport_front}
                        onFileSelect={handleFileSelect}
                        fieldName="passport_front"
                        helperText="Ensure the photo page is clear and glare-free."
                      />
                      <UploadCard
                        label="Passport Back"
                        icon="Address"
                        file={files.passport_back}
                        onFileSelect={handleFileSelect}
                        fieldName="passport_back"
                        helperText="Upload the address page from your passport."
                      />
                      <UploadCard
                        label="PAN Card"
                        icon="PAN"
                        file={files.pan_card}
                        onFileSelect={handleFileSelect}
                        fieldName="pan_card"
                        helperText="Capture the full card within the frame."
                      />
                    </div>

                    <div className="wizard-actions">
                      <button
                        type="button"
                        onClick={() => {
                          processDocuments();
                          goToStep(2);
                        }}
                        disabled={
                          isProcessing ||
                          !files.passport_front ||
                          !files.passport_back ||
                          !files.pan_card
                        }
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

                {currentStep === 2 && (
                  <div className="space-y-8">
                    <div className="wizard-header">
                      <h2>Upload Your Selfie</h2>
                      <p>Add your profile photo before moving to the verification screen.</p>
                    </div>

                    <div className="selfie-panel">
                      <div className="selfie-panel-title">
                        <HiOutlineInformationCircle />
                        <span>Profile Photo</span>
                      </div>
                      <p className="processing-selfie-copy">
                        Please upload a clear selfie in good lighting. We&apos;ll use it for the
                        final registration record.
                      </p>
                      <UploadCard
                        label="Profile Photo"
                        icon="Selfie"
                        file={files.selfie}
                        onFileSelect={handleFileSelect}
                        fieldName="selfie"
                        helperText="Look straight into the camera in good lighting."
                      />
                    </div>

                    <div className="wizard-actions">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!files.selfie) {
                            toast.error('Please upload your selfie to continue');
                            return;
                          }

                          if (documentProcessingState === 'success') {
                            goToStep(3);
                            return;
                          }

                          if (documentProcessingState === 'error') {
                            goToStep(3);
                            return;
                          }

                          setIsAwaitingProcessingResult(true);
                          try {
                            await processDocuments();
                          } finally {
                            setIsAwaitingProcessingResult(false);
                            goToStep(3);
                          }
                        }}
                        disabled={!files.selfie || isAwaitingProcessingResult}
                        className="cta-primary cta-primary-wide"
                      >
                        {isAwaitingProcessingResult
                          ? 'Processing Documents...'
                          : documentProcessingState === 'success'
                            ? 'Continue to Verify Details'
                            : 'Submit Selfie & Continue'}
                        {!isAwaitingProcessingResult && <HiOutlineArrowRight />}
                      </button>
                      <button type="button" onClick={() => goToStep(1)} className="link-button">
                        Back to Uploads
                      </button>
                    </div>
                  </div>
                )}

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

                {currentStep === 4 && registrationResult && (
                  <div className="success-panel">
                    <div className="success-icon">
                      <HiOutlineCheckCircle />
                    </div>
                    <div>
                      <h2>All Set!</h2>
                      <p>Your registration is complete.</p>
                      <div className="success-ref">Ref: {registrationResult.registrationId}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        getWizardStorage()?.removeItem(WIZARD_STORAGE_KEY);
                        window.location.reload();
                      }}
                      className="cta-secondary"
                    >
                      Start New Registration
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {currentStep === 0 && (
        <motion.div
          className="floating-home-cta"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 3.0 }}
        >
          <div className="floating-home-cta-trip">
            <span>3rd July</span>
            <div className="floating-home-cta-route" aria-hidden="true">
              <span className="floating-home-cta-line" />
              <span className="floating-home-cta-plane" role="img" aria-label="plane">
                ✈︎
              </span>
              <span className="floating-home-cta-line" />
            </div>
            <span>5th July</span>
          </div>
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

      <AnimatePresence>
        {isItineraryOpen && (
          <motion.div
            className="overlay-shell overlay-shell-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsItineraryOpen(false)}
          >
            <motion.div
              className="itinerary-modal"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 240, damping: 24 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="overlay-close overlay-close-light"
                aria-label="Close itinerary message"
                onClick={() => setIsItineraryOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
              <img
                src={itineraryImage}
                alt="Itinerary visual"
                className="overlay-image overlay-image-wide"
              />
              <div className="overlay-copy">
                <span className="overlay-kicker">Itinerary</span>
                <h3>Itinerary is being prepared</h3>
              </div>
            </motion.div>
          </motion.div>
        )}

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
              <div className="processing-visual-stack" aria-hidden="true">
                {PROCESSING_IMAGES.map((image, index) => (
                  <motion.div
                    key={image}
                    className={`processing-photo-card processing-photo-card-${index + 1}`}
                    initial={
                      index === 0
                        ? { x: -72, y: 28, rotate: -24, scale: 0.88, opacity: 0 }
                        : index === 1
                          ? { x: 0, y: -54, rotate: 18, scale: 0.84, opacity: 0 }
                          : { x: 76, y: 34, rotate: 24, scale: 0.88, opacity: 0 }
                    }
                    animate={{
                      opacity: 1,
                      x: [0, 0, 0],
                      y: [0, -6, 0],
                      rotate:
                        index === 0
                          ? [-8, -4, -8]
                          : index === 1
                            ? [0, 3, 0]
                            : [8, 5, 8],
                      scale: [1, 1.02, 1],
                    }}
                    transition={{
                      duration: 2.8 + index * 0.25,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: index * 0.12,
                    }}
                  >
                    <img src={image} alt="" />
                  </motion.div>
                ))}
              </div>

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
      </AnimatePresence>
    </div>
  );
};

export default Home;
