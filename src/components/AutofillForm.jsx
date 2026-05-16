import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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

function Field({ field, formData, errors, onChange }) {
  return (
    <motion.div variants={itemVariants} className={field.colSpan === 2 ? 'sm:col-span-2' : ''}>
      <label className="form-label" htmlFor={field.key}>
        {field.label}
      </label>
      <input
        type="text"
        id={field.key}
        className={`form-input ${field.mono ? 'font-mono tracking-wider' : ''}`}
        placeholder={field.placeholder}
        value={formData[field.key] || ''}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
      {errors?.[field.key] && <p className="mt-1 text-xs text-red-500">{errors[field.key]}</p>}
    </motion.div>
  );
}

export default function AutofillForm({ formData, onChange, errors, selfieFile, files }) {
  const selfieUrl = useObjectUrl(selfieFile);
  const passportFrontUrl = useObjectUrl(files?.passport_front);
  const passportBackUrl = useObjectUrl(files?.passport_back);
  const panCardUrl = useObjectUrl(files?.pan_card);

  const handleChange = (key, value) => {
    onChange({ ...formData, [key]: value });
  };

  const handlePhoneChange = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    const formatted = digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
    handleChange('contact_number', formatted);
  };

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

        <DocumentPreview
          src={passportFrontUrl}
          alt="Passport front preview"
          emptyLabel="Passport front preview unavailable"
        />

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {PASSPORT_FRONT_FIELDS.map((field) => (
            <Field
              key={field.key}
              field={field}
              formData={formData}
              errors={errors}
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

        <DocumentPreview
          src={passportBackUrl}
          alt="Passport back preview"
          emptyLabel="Passport back preview unavailable"
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

        <DocumentPreview src={panCardUrl} alt="PAN card preview" emptyLabel="PAN card preview unavailable" />

        <div className="mt-6">
          <label className="form-label" htmlFor="pan_number">
            PAN Number
          </label>
          <input
            type="text"
            id="pan_number"
            className="form-input max-w-xs font-mono uppercase tracking-[0.2em]"
            placeholder="ABCDE1234F"
            value={formData.pan_number || ''}
            onChange={(event) => handleChange('pan_number', event.target.value.toUpperCase())}
            maxLength={10}
          />
          {errors?.pan_number && <p className="mt-1 text-xs text-red-500">{errors.pan_number}</p>}
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
              Contact Number
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
              Email Address
            </label>
            <input
              type="email"
              id="email"
              className="form-input"
              placeholder="john@example.com"
              value={formData.email || ''}
              onChange={(event) => handleChange('email', event.target.value)}
            />
            {errors?.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>

          <div className="sm:col-span-2">
            <div className="max-w-xs">
              <label className="form-label" htmlFor="meal_preference">
                Meal Preference
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
