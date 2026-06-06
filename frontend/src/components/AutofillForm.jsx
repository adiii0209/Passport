import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';

function parseDateString(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{2})[-/.](\d{2})[-/.](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10)));
}
import {
  HiOutlineCreditCard,
  HiOutlineIdentification,
  HiOutlineLocationMarker,
  HiOutlinePhone,
  HiOutlineUserCircle,
} from 'react-icons/hi';

const PASSPORT_FRONT_FIELDS = [
  { key: 'given_name', label: 'Given Name', placeholder: 'John' },
  { key: 'surname', label: 'Surname', placeholder: 'Doe' },
  { key: 'full_name', label: 'Full Name', placeholder: 'John Doe', colSpan: 2 },
  { key: 'passport_number', label: 'Passport Number', placeholder: 'A1234567', mono: true },
  { key: 'date_of_birth', label: 'Date of Birth', placeholder: 'DD-MM-YYYY' },
  { key: 'date_of_issue', label: 'Date of Issue', placeholder: 'DD-MM-YYYY' },
  { key: 'date_of_expiry', label: 'Date of Expiry', placeholder: 'DD-MM-YYYY' },
  { key: 'place_of_birth', label: 'Place of Birth', placeholder: 'Mumbai' },
  { key: 'place_of_issue', label: 'Place of Issue', placeholder: 'Mumbai' },
];

const MEAL_OPTIONS = [
  { value: '', label: 'Select preference' },
  { value: 'Veg', label: 'Vegetarian' },
  { value: 'Non-Veg', label: 'Non-Vegetarian' },
  { value: 'Jain', label: 'Jain' },
  { value: 'Vegan', label: 'Vegan' },
  { value: 'No Preference', label: 'No Preference' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const sectionIconClass =
  'flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-600';

function normalizeUppercaseValue(value) {
  return typeof value === 'string' ? value.toUpperCase() : value;
}

function normalizeFieldValue(key, value) {
  if (typeof value !== 'string') return value;
  if (key === 'email' || key === 'meal_preference') return value;
  return normalizeUppercaseValue(value);
}

function formatContactNumber(value) {
  const raw = String(value || '');
  const digits = raw.replace(/\D/g, '');

  if (!digits) return '';

  const localDigits = digits.length > 10 ? digits.slice(-10) : digits;
  if (localDigits.length <= 5) return localDigits;
  return `${localDigits.slice(0, 5)} ${localDigits.slice(5)}`;
}

function getLiveEmailError(value, allowedEmailDomains = []) {
  const email = String(value || '').trim();
  if (!email) return '';

  if (allowedEmailDomains.length === 0) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Enter a valid email address';
  }

  const emailDomain = email.split('@')[1]?.toLowerCase();
  const normalizedDomains = allowedEmailDomains
    .map((domain) => String(domain || '').trim().toLowerCase())
    .filter(Boolean);

  if (normalizedDomains.includes(emailDomain)) return '';

  return `Email must be from: ${normalizedDomains.join(', ')}`;
}

function useObjectUrl(file) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return undefined;
    }

    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [file]);

  return url;
}

function DocumentPreview({ src, alt, emptyLabel }) {
  return (
    <div className="document-preview-frame">
      {src ? (
        <img src={src} alt={alt} className="document-preview-image" />
      ) : (
        <div className="document-preview-empty">{emptyLabel}</div>
      )}
    </div>
  );
}

function DocumentFilePreview({ file, src, alt, emptyLabel, title }) {
  const isImageFile = file?.type?.startsWith('image/');

  if (isImageFile && src) {
    return <DocumentPreview src={src} alt={alt} emptyLabel={emptyLabel} />;
  }

  if (file) {
    return (
      <div className="document-preview-frame">
        <div className="document-preview-empty">
          <div className="space-y-2 text-center">
            <p className="font-semibold uppercase text-slate-700">{title}</p>
            <p className="break-all text-xs text-slate-500">{file.name}</p>
          </div>
        </div>
      </div>
    );
  }

  return <DocumentPreview src={src} alt={alt} emptyLabel={emptyLabel} />;
}

function Field({ field, formData, errors, warning, onChange }) {
  const hasWarning = warning && !errors?.[field.key];
  return (
    <motion.div variants={itemVariants} className={field.colSpan === 2 ? 'sm:col-span-2' : ''}>
      <label className="form-label" htmlFor={field.key}>
        {field.label}
      </label>
      <input
        type="text"
        id={field.key}
        className={`form-input ${field.mono ? 'font-mono tracking-wider' : ''} ${hasWarning ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500/20' : ''}`}
        placeholder={field.placeholder}
        value={formData[field.key] || ''}
        onChange={(event) => onChange(field.key, normalizeFieldValue(field.key, event.target.value))}
      />
      {errors?.[field.key] ? (
        <p className="mt-1 text-xs text-red-500">{errors[field.key]}</p>
      ) : warning ? (
        <p className="mt-1 text-xs text-amber-500">{warning}</p>
      ) : null}
    </motion.div>
  );
}

export default function AutofillForm({
  formData,
  onChange,
  errors,
  selfieFile,
  files,
  allowedEmailDomains = [],
  requiredFormFields = {},
}) {
  const selfieUrl = useObjectUrl(selfieFile);
  const passportFrontUrl = useObjectUrl(files?.passport_front);
  const passportBackUrl = useObjectUrl(files?.passport_back);
  const panCardUrl = useObjectUrl(files?.pan_card);
  const primaryEmailDomain = allowedEmailDomains[0] || 'gmail.com';
  const fieldRequirements = {
    contact_number: requiredFormFields.contact_number !== false,
    email: requiredFormFields.email !== false,
    meal_preference: requiredFormFields.meal_preference !== false,
  };

  const warnings = useMemo(() => {
    const w = {};
    if (formData.date_of_birth) {
      const dob = parseDateString(formData.date_of_birth);
      if (!dob) {
        w.date_of_birth = 'Ambiguous: Invalid date format (DD-MM-YYYY)';
      } else if (dob.getTime() >= Date.now()) {
        w.date_of_birth = 'Ambiguous: Date of birth should be before the current date';
      }
    }
    
    if (formData.date_of_expiry) {
      const expiry = parseDateString(formData.date_of_expiry);
      if (!expiry) {
        w.date_of_expiry = 'Ambiguous: Invalid date format (DD-MM-YYYY)';
      } else if (formData.date_of_issue) {
        const issue = parseDateString(formData.date_of_issue);
        if (issue) {
          const expected = new Date(issue.getTime());
          expected.setUTCFullYear(expected.getUTCFullYear() + 10);
          expected.setUTCDate(expected.getUTCDate() - 1);
          if (expiry.getTime() !== expected.getTime()) {
            w.date_of_expiry = 'Ambiguous: Expiry is typically 10 years minus 1 day from Issue';
          }
        }
      }
    }
    
    if (formData.pan_number) {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(formData.pan_number)) {
        w.pan_number = 'Ambiguous: Format must be 5 letters, 4 numbers, 1 letter';
      }
    }
    return w;
  }, [formData.date_of_birth, formData.date_of_issue, formData.date_of_expiry, formData.pan_number]);

  const handleChange = (key, value) => {
    onChange({ ...formData, [key]: normalizeFieldValue(key, value) });
  };

  const handlePhoneChange = (value) => {
    handleChange('contact_number', formatContactNumber(value));
  };

  const liveEmailError = getLiveEmailError(formData.email, allowedEmailDomains);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
      <motion.div variants={itemVariants} className="glass-card verify-identity-card">
        <div className="verify-identity-avatar">
          {selfieUrl ? (
            <img src={selfieUrl} alt="Uploaded selfie" className="verify-identity-avatar-image" />
          ) : (
            <HiOutlineUserCircle className="h-12 w-12" />
          )}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Uploaded Selfie</h3>
          <p className="text-sm text-slate-500">
            This selfie will be attached to your final registration. No need to upload it again.
          </p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card p-5 sm:p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className={sectionIconClass}>
            <HiOutlineIdentification className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">Passport Front Details</h3>
            <p className="text-xs text-slate-500">Preview and confirm the extracted passport front fields</p>
          </div>
        </div>

        <DocumentFilePreview
          file={files?.passport_front}
          src={passportFrontUrl}
          alt="Passport front preview"
          emptyLabel="Passport front preview unavailable"
          title="Passport Front"
        />

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {PASSPORT_FRONT_FIELDS.map((field) => (
            <Field
              key={field.key}
              field={field}
              formData={formData}
              errors={errors}
              warning={warnings[field.key]}
              onChange={handleChange}
            />
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card p-5 sm:p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className={sectionIconClass}>
            <HiOutlineLocationMarker className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">Passport Back Address</h3>
            <p className="text-xs text-slate-500">Use the passport back preview to verify the extracted address</p>
          </div>
        </div>

        <DocumentFilePreview
          file={files?.passport_back}
          src={passportBackUrl}
          alt="Passport back preview"
          emptyLabel="Passport back preview unavailable"
          title="Passport Back"
        />

        <motion.div variants={itemVariants} className="mt-6">
          <label className="form-label" htmlFor="passport_address">
            Passport Address
          </label>
          <textarea
            id="passport_address"
            className="form-input min-h-[108px] resize-y"
            placeholder="Full address as on passport"
            value={formData.passport_address || ''}
            onChange={(event) => handleChange('passport_address', event.target.value)}
            rows={4}
          />
          {errors?.passport_address && <p className="mt-1 text-xs text-red-500">{errors.passport_address}</p>}
        </motion.div>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card p-5 sm:p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className={sectionIconClass}>
            <HiOutlineCreditCard className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">PAN Card</h3>
            <p className="text-xs text-slate-500">Preview the PAN card and confirm the PAN number below</p>
          </div>
        </div>

        <DocumentFilePreview
          file={files?.pan_card}
          src={panCardUrl}
          alt="PAN card preview"
          emptyLabel="PAN card preview unavailable"
          title="PAN Card"
        />

        <div className="mt-6">
          <label className="form-label" htmlFor="pan_number">
            PAN Number
          </label>
          <input
            type="text"
            id="pan_number"
            className={`form-input max-w-xs font-mono uppercase tracking-[0.2em] ${warnings.pan_number && !errors?.pan_number ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500/20' : ''}`}
            placeholder="ABCDE1234F"
            value={formData.pan_number || ''}
            onChange={(event) => handleChange('pan_number', event.target.value.toUpperCase())}
            maxLength={10}
          />
          {errors?.pan_number ? (
            <p className="mt-1 text-xs text-red-500">{errors.pan_number}</p>
          ) : warnings?.pan_number ? (
            <p className="mt-1 text-xs text-amber-500">{warnings.pan_number}</p>
          ) : null}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className={sectionIconClass}>
            <HiOutlinePhone className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">Contact, Email and Meal</h3>
            <p className="text-xs text-slate-500">Complete the final traveler details before submission</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="form-label" htmlFor="contact_number">
              Contact Number{fieldRequirements.contact_number ? ' *' : ' (Optional)'}
            </label>
            <div className="contact-row">
              <div className="contact-prefix">+91</div>
              <input
                type="tel"
                id="contact_number"
                className="form-input contact-input font-mono tracking-wider"
                placeholder="99999 99999"
                value={formData.contact_number || ''}
                onChange={(event) => handlePhoneChange(event.target.value)}
              />
            </div>
            {errors?.contact_number && <p className="mt-1 text-xs text-red-500">{errors.contact_number}</p>}
          </div>

          <div>
            <label className="form-label" htmlFor="email">
              Email Address{fieldRequirements.email ? ' *' : ' (Optional)'}
            </label>
            <input
              type="email"
              id="email"
              className="form-input"
                placeholder={`name@${primaryEmailDomain}`}
              value={formData.email || ''}
              onChange={(event) => handleChange('email', event.target.value)}
            />
            {(liveEmailError || errors?.email) && (
              <p className="mt-1 text-xs text-red-500">{liveEmailError || errors.email}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <div className="max-w-xs">
              <label className="form-label" htmlFor="meal_preference">
                Meal Preference{fieldRequirements.meal_preference ? ' *' : ' (Optional)'}
              </label>
              <select
                id="meal_preference"
                className="form-select"
                value={formData.meal_preference || ''}
                onChange={(event) => handleChange('meal_preference', event.target.value)}
              >
                {MEAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors?.meal_preference && <p className="mt-1 text-xs text-red-500">{errors.meal_preference}</p>}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
