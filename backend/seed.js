require('dotenv').config({ override: true });
const { connectDb, closeDb } = require('./services/db');
const portalService = require('./services/portalService');

async function seedPortals() {
  try {
    await connectDb();
    console.log('Connected to DB, seeding portals...');

    const langkawiPortal = {
      title: 'Langkawi 2026',
      subtitle: 'Join us for an amazing retreat in Langkawi.',
      slug: 'langkawi',
      isActive: true,
      travelDates: {
        start: '2026-07-01',
        end: '2026-07-05',
        displayText: 'July 1 - July 5, 2026',
      },
      hero: { type: 'image', url: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=1920&q=80' },
      theme: { primaryColor: '#6366f1', accentColor: '#f59e0b', heroOverlayOpacity: 0.4 },
      requiredDocuments: [
        { key: 'passport_front', label: 'Passport Front', required: true, helperText: 'Ensure the photo page is clear and glare-free.' },
        { key: 'passport_back', label: 'Passport Back', required: true, helperText: 'Upload the address page from your passport.' },
        { key: 'pan_card', label: 'PAN Card', required: true, helperText: 'Capture the full card within the frame.' },
        { key: 'selfie', label: 'Profile Photo', required: true, helperText: 'Look straight into the camera in good lighting.' }
      ],
      allowedEmailDomains: []
    };

    const testPortal = {
      title: 'Test Portal',
      subtitle: 'A testing environment for the multi-portal system.',
      slug: 'test',
      isActive: true,
      travelDates: {
        start: '2026-10-10',
        end: '2026-10-15',
        displayText: 'Oct 10 - Oct 15, 2026',
      },
      hero: { type: 'image', url: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1920&q=80' },
      theme: { primaryColor: '#10b981', accentColor: '#3b82f6', heroOverlayOpacity: 0.6 },
      requiredDocuments: [
        { key: 'passport_front', label: 'Passport Front', required: true, helperText: 'Ensure the photo page is clear and glare-free.' },
        { key: 'passport_back', label: 'Passport Back', required: true, helperText: 'Upload the address page from your passport.' },
        { key: 'pan_card', label: 'PAN Card', required: true, helperText: 'Capture the full card within the frame.' },
        { key: 'selfie', label: 'Profile Photo', required: true, helperText: 'Look straight into the camera in good lighting.' }
      ],
      allowedEmailDomains: []
    };

    // Use internal service to bypass validation restrictions if needed, or just standard CRUD
    try {
      await portalService.createPortal(langkawiPortal);
      console.log('✅ Langkawi portal created!');
    } catch (err) {
      console.log('Langkawi portal might already exist:', err.message);
    }

    try {
      await portalService.createPortal(testPortal);
      console.log('✅ Test portal created!');
    } catch (err) {
      console.log('Test portal might already exist:', err.message);
    }

  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await closeDb();
  }
}

seedPortals();
