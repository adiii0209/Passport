import { useCallback, useEffect, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import imageCompression from 'browser-image-compression';
import {
  HiCheck,
  HiX,
  HiOutlineCamera,
  HiOutlineDocumentText,
  HiOutlineUserCircle,
} from 'react-icons/hi';
import { toast } from 'react-hot-toast';
import passportFrontPlaceholder from '../assets/passport-front.png';
import passportBackPlaceholder from '../assets/passport-back.png';
import panPlaceholder from '../assets/pan.png';
import selfiePlaceholder from '../assets/selfie.png';

function DocumentPlaceholder({ fieldName }) {
  if (fieldName === 'selfie') {
    return (
      <div className="h-full w-full overflow-hidden">
        <img
          src={selfiePlaceholder}
          alt="Selfie placeholder"
          className="h-full w-full object-cover scale-100"
        />
      </div>
    );
  }

  if (fieldName === 'passport_front') {
    return (
      <div className="h-full w-full">
        <img
          src={passportFrontPlaceholder}
          alt="Passport front placeholder"
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  if (fieldName === 'passport_back') {
    return (
      <div className="h-full w-full">
        <img
          src={passportBackPlaceholder}
          alt="Passport back placeholder"
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <img
        src={panPlaceholder}
        alt="PAN placeholder"
        className="h-full w-full object-cover scale-150"
      />
    </div>
  );
}

export default function UploadCard({
  label,
  fieldName,
  capture = null,
  onFileSelect,
  file,
  icon,
  helperText,
}) {
  const [preview, setPreview] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const cameraInputRef = useRef(null);
  const isSelfie = fieldName === 'selfie';
  const acceptedTypes = isSelfie
    ? { 'image/*': ['.jpeg', '.jpg', '.png'] }
    : {
        'image/*': ['.jpeg', '.jpg', '.png'],
        'application/pdf': ['.pdf'],
      };
  const isImageFile = file?.type?.startsWith('image/');
  const isPdfFile = file?.type === 'application/pdf';

  useEffect(() => {
    if (!file || !isImageFile) {
      setPreview((currentPreview) => {
        if (currentPreview) {
          URL.revokeObjectURL(currentPreview);
        }
        return null;
      });
      return undefined;
    }

    const previewUrl = URL.createObjectURL(file);
    setPreview((currentPreview) => {
      if (currentPreview) {
        URL.revokeObjectURL(currentPreview);
      }
      return previewUrl;
    });

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [file, isImageFile]);

  const processFile = useCallback(
    async (originalFile) => {
      if (!originalFile) return;

      if (originalFile.type === 'application/pdf' && originalFile.size > 5 * 1024 * 1024) {
        toast.error(`PDF size limit is 5MB`);
        return;
      }

      if (!originalFile.type?.startsWith('image/')) {
        onFileSelect(fieldName, originalFile);
        return;
      }

      setIsCompressing(true);

      try {
        const compressedFile = await imageCompression(originalFile, {
          maxSizeMB: 2,
          maxWidthOrHeight: 2048,
          useWebWorker: true,
          fileType: 'image/jpeg',
        });
        onFileSelect(fieldName, compressedFile);
      } catch (err) {
        console.error('Compression failed, using original:', err);
        onFileSelect(fieldName, originalFile);
      } finally {
        setIsCompressing(false);
      }
    },
    [fieldName, onFileSelect]
  );

  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        processFile(acceptedFiles[0]);
      }

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [processFile]
  );

  const { getRootProps, getInputProps, isDragActive, open: openFilePicker, inputRef } = useDropzone({
    onDrop,
    accept: acceptedTypes,
    maxFiles: 1,
    multiple: false,
    noClick: true,
    noKeyboard: true,
  });

  const handleCameraCapture = (event) => {
    const nextFile = event.target.files?.[0];
    if (nextFile) processFile(nextFile);
    event.target.value = '';
  };

  const handleOpenCamera = (event) => {
    event.stopPropagation();
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    }
  };

  const handleOpenFile = (event) => {
    event.stopPropagation();
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    openFilePicker();
  };

  const removeFile = (event) => {
    event.stopPropagation();
    onFileSelect(fieldName, null);
  };

  const hasFile = Boolean(file);
  const previewLabel = isSelfie ? 'Profile Preview' : label.toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-bold text-slate-500">{icon || 'File'}</span>
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-700">{label}</span>
      </div>

      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'active' : ''} ${hasFile ? 'success' : ''}`}
      >
        <input {...getInputProps()} />

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture={capture === 'user' ? 'user' : 'environment'}
          onChange={handleCameraCapture}
          style={{ display: 'none' }}
        />

        <div className={`upload-preview-shell ${isSelfie ? 'is-selfie' : 'is-document'} ${hasFile ? 'has-file' : ''}`}>
          {!(['passport_front', 'passport_back', 'pan_card'].includes(fieldName) && !hasFile) && (
            <>
              <div className="upload-preview-corner corner-top-left" />
              <div className="upload-preview-corner corner-top-right" />
              <div className="upload-preview-corner corner-bottom-left" />
              <div className="upload-preview-corner corner-bottom-right" />
            </>
          )}

          <AnimatePresence mode="wait">
            {isCompressing ? (
              <motion.div
                key="compressing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="upload-preview-placeholder"
              >
                <div className="spinner" />
                <p className="text-sm text-slate-500">Preparing preview...</p>
              </motion.div>
            ) : hasFile && isImageFile ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                className="upload-preview-live"
              >
                <img src={preview} alt={`${label} preview`} className="upload-preview-image" />
                <div className="preview-badge">
                  <HiCheck /> Uploaded
                </div>
                <button type="button" onClick={removeFile} className="preview-remove" title="Remove">
                  <HiX />
                </button>
              </motion.div>
            ) : hasFile ? (
              <motion.div
                key="file-preview"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                className="upload-preview-live flex flex-col items-center justify-center gap-3 p-6 text-center"
              >
                <HiOutlineDocumentText className="h-12 w-12 text-slate-500" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-700">{previewLabel}</p>
                  <p className="text-xs break-all text-slate-500">{file.name}</p>
                </div>
                <div className="preview-badge">
                  <HiCheck /> Uploaded
                </div>
                <button type="button" onClick={removeFile} className="preview-remove" title="Remove">
                  <HiX />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`upload-preview-placeholder ${isSelfie ? 'is-selfie' : 'is-document'}`}
              >
                <DocumentPlaceholder fieldName={fieldName} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="dropzone-text">
          {isDragActive ? (
            <p>Drop your file here</p>
          ) : (
            <p className="text-xs text-slate-500">Place the file clearly inside the frame and upload below</p>
          )}
        </div>

        {!isCompressing && (
          <div className="upload-action-row">
            <button
              type="button"
              onClick={handleOpenCamera}
              className="upload-action-btn"
            >
              <HiOutlineCamera className="h-4 w-4" />
              <span>Camera</span>
            </button>
            <button
              type="button"
              onClick={handleOpenFile}
              className="upload-action-btn"
            >
              <HiOutlineDocumentText className="h-4 w-4" />
              <span>File</span>
            </button>
          </div>
        )}
      </div>

      {helperText && !hasFile && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 pl-1 text-xs text-slate-500"
        >
          Tip: {helperText}
        </motion.p>
      )}
    </motion.div>
  );
}
