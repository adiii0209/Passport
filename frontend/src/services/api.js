/**
 * API Service Layer
 * Centralized Axios instance with interceptors for all backend communication
 */

import axios from 'axios';

// Base URL — uses Vite proxy in development, absolute URL in production
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 2 minutes — OCR can be slow
  headers: {
    Accept: 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`📡 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error normalization
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred';

    console.error('🔴 API Error:', message);
    return Promise.reject(new Error(message));
  }
);

/**
 * Upload passport front + back images for OCR extraction
 * @param {File} frontFile - Passport front image
 * @param {File} backFile - Passport back image
 * @param {Function} onProgress - Upload progress callback (0-100)
 * @returns {Object} - { success, data, files, ocrText, tempFolderId }
 */
export async function extractPassport(frontFile, backFile, portalSlug, onProgress) {
  const formData = new FormData();
  formData.append('passport_front', frontFile);
  formData.append('passport_back', backFile);
  if (portalSlug) formData.append('portalSlug', portalSlug);

  const response = await api.post('/extract-passport', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  return response.data;
}

/**
 * Upload PAN card image for OCR extraction
 * @param {File} panFile - PAN card image
 * @param {string} tempFolderId - Temp folder from passport extraction (optional)
 * @param {Function} onProgress - Upload progress callback
 * @returns {Object} - { success, data, file, ocrText }
 */
export async function extractPan(panFile, fullName, portalSlug, onProgress) {
  const formData = new FormData();
  formData.append('pan_card', panFile);
  if (fullName) {
    formData.append('full_name', fullName);
  }
  if (portalSlug) formData.append('portalSlug', portalSlug);

  const response = await api.post('/extract-pan', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  return response.data;
}

/**
 * Submit final registration with selfie + form data
 * @param {Object} formData - All form field values
 * @param {File|null} selfieFile - Selfie image file
 * @param {Function} onProgress - Upload progress callback
 * @returns {Object} - { success, registrationId, message, folderLink }
 */
export async function submitRegistration(formData, selfieFile, onProgress) {
  const payload = new FormData();

  // Append all form fields
  Object.entries(formData).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      payload.append(key, value);
    }
  });

  // Append selfie if provided
  if (selfieFile) {
    payload.append('selfie', selfieFile);
  }

  const response = await api.post('/submit-registration', payload, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  return response.data;
}

/**
 * Health check endpoint
 * @returns {Object} - { status, timestamp, uptime }
 */
export async function checkHealth(timeout = 4000) {
  const response = await api.get('/health', { timeout });
  return response.data;
}

export default api;
