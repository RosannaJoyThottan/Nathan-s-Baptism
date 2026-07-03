import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  Image as ImageIcon,
  Upload,
  Music,
  ChevronLeft,
  ChevronRight,
  X,
  Camera,
  CheckCircle,
  Database,
  Volume2,
  VolumeX,
  Map,
  Smile,
  Download,
  ChevronDown,
  Trash2,
  Lock
} from 'lucide-react';

// IndexedDB Helper implementation for client-side standalone mode
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BaptismPhotosDB', 2);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('photos')) {
        db.createObjectStore('photos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('blessings')) {
        db.createObjectStore('blessings', { keyPath: 'id' });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

const getIndexedDBPhotos = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('photos', 'readonly');
      const store = transaction.objectStore('photos');
      const request = store.getAll();
      request.onsuccess = () => {
        const photos = request.result.sort((a, b) => b.id - a.id);
        resolve(photos);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('IndexedDB load failed:', err);
    return [];
  }
};

const saveIndexedDBPhoto = async (photo) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('photos', 'readwrite');
    const store = transaction.objectStore('photos');
    const request = store.add(photo);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const getIndexedDBBlessings = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('blessings', 'readonly');
      const store = transaction.objectStore('blessings');
      const request = store.getAll();
      request.onsuccess = () => {
        const blessings = request.result.sort((a, b) => b.id - a.id);
        resolve(blessings);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('IndexedDB load blessings failed:', err);
    return [];
  }
};

const saveIndexedDBBlessing = async (blessing) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('blessings', 'readwrite');
    const store = transaction.objectStore('blessings');
    const request = store.add(blessing);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

function App() {
  const [activeTab, setActiveTab] = useState('invitation');
  const [isEnvelopeOpened, setIsEnvelopeOpened] = useState(false);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);

  // Custom Administrative States
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // Sync hash state with admin mode
  useEffect(() => {
    const handleHash = () => {
      const mode = window.location.hash.toLowerCase() === '#admin';
      setIsAdminMode(mode);
      // Pre-fill pin from session storage if present
      const savedPin = sessionStorage.getItem('admin_pin');
      if (savedPin) {
        setAdminPinInput(savedPin);
        setIsAdminAuthenticated(true);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleVerifyPin = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: adminPinInput })
      });
      if (res.ok) {
        setIsAdminAuthenticated(true);
        sessionStorage.setItem('admin_pin', adminPinInput);
        setToast({ text: 'Welcome, Admin!', type: 'success' });
      } else {
        setToast({ text: 'Invalid administrative passcode!', type: 'error' });
      }
    } catch (err) {
      setToast({ text: 'Unable to communicate with verification server.', type: 'error' });
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm('Are you sure you want to delete this photo? This cannot be undone.')) {
      return;
    }
    try {
      const pin = sessionStorage.getItem('admin_pin') || adminPinInput;
      const res = await fetch(`/api/photos/${photoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${pin}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToast({ text: 'Photo deleted successfully.', type: 'success' });
        setPhotos(prev => prev.filter(img => img.id !== photoId));
      } else {
        setToast({ text: data.message || 'Failed to delete photo.', type: 'error' });
      }
    } catch (err) {
      setToast({ text: 'Failed to delete photo. Connection issue.', type: 'error' });
    }
  };

  const handleDeleteBlessing = async (blessingId) => {
    if (!window.confirm('Are you sure you want to delete this blessing? This cannot be undone.')) {
      return;
    }
    try {
      const pin = sessionStorage.getItem('admin_pin') || adminPinInput;
      const res = await fetch(`/api/blessings/${blessingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${pin}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToast({ text: 'Blessing deleted successfully.', type: 'success' });
        setBlessings(prev => prev.filter(b => b.id !== blessingId));
      } else {
        setToast({ text: data.message || 'Failed to delete blessing.', type: 'error' });
      }
    } catch (err) {
      setToast({ text: 'Failed to delete blessing. Connection issue.', type: 'error' });
    }
  };
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [photos, setPhotos] = useState([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [blessings, setBlessings] = useState([]);
  const [isLoadingBlessings, setIsLoadingBlessings] = useState(false);
  const [toast, setToast] = useState(null);
  const [albumView, setAlbumView] = useState('photos'); // 'photos' or 'blessings'
  const [uploadType, setUploadType] = useState('photo'); // 'photo' or 'blessing'
  const [blessingMessage, setBlessingMessage] = useState('');

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [mobileHelpPhoto, setMobileHelpPhoto] = useState(null);

  // Upload Form State
  const [guestName, setGuestName] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [photoDropdownOpen, setPhotoDropdownOpen] = useState(false);
  const [blessingDropdownOpen, setBlessingDropdownOpen] = useState(false);
  const photoDropdownRef = useRef(null);
  const blessingDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (photoDropdownRef.current && !photoDropdownRef.current.contains(event.target)) {
        setPhotoDropdownOpen(false);
      }
      if (blessingDropdownRef.current && !blessingDropdownRef.current.contains(event.target)) {
        setBlessingDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const audioRef = useRef(null);

  // Countdown target: August 2nd, 2026 at 11:45 AM
  const targetDate = new Date('2026-08-02T11:45:00').getTime();
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isOver: false
  });

  // Check backend server availability on startup
  useEffect(() => {
    checkBackendAndLoadPhotos();
  }, []);

  // Countdown timer clock
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true });
        clearInterval(interval);
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds, isOver: false });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Show Toast Auto Dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const checkBackendAndLoadPhotos = async () => {
    setIsLoadingPhotos(true);
    setIsLoadingBlessings(true);
    try {
      const res = await fetch('/api/photos');
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos || []);
        setBackendAvailable(true);
      } else {
        throw new Error('Server returned non-ok status');
      }

      // Load blessings from API
      const resBlessings = await fetch('/api/blessings');
      if (resBlessings.ok) {
        const data = await resBlessings.json();
        setBlessings(data.blessings || []);
      }
    } catch (err) {
      console.warn('Backend server is not running or unreachable. Using IndexedDB local storage instead.', err.message);
      setBackendAvailable(false);
      // Load offline photo cached in IndexedDB
      const offlinePhotos = await getIndexedDBPhotos();
      setPhotos(offlinePhotos);
      // Load offline blessings cached in IndexedDB
      const offlineBlessings = await getIndexedDBBlessings();
      setBlessings(offlineBlessings);
    } finally {
      setIsLoadingPhotos(false);
      setIsLoadingBlessings(false);
    }
  };

  const handleOpenEnvelope = () => {
    setIsEnvelopeOpened(true);
    // Start background music when guests open the invite (user interaction, allowed by Autoplay)
    if (audioRef.current && !isPlayingMusic) {
      audioRef.current.play()
        .then(() => setIsPlayingMusic(true))
        .catch(err => console.log('Audio autoplay blocked or failed:', err));
    }
  };

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (isPlayingMusic) {
      audioRef.current.pause();
      setIsPlayingMusic(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlayingMusic(true))
        .catch(err => console.log('Audio play failed:', err));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (PNG, JPG, JPEG)');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setPreviewUrl('');
  };

  const handlePhotoUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select or capture a photo first.');
      return;
    }

    setIsUploading(true);

    try {
      if (backendAvailable) {
        // Upload to Node Express API
        const formData = new FormData();
        formData.append('photo', selectedFile);
        formData.append('guestName', guestName.trim() || 'Guest');
        formData.append('caption', caption.trim() || '');

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || 'Upload failed');
        }

        const data = await res.json();
        // Insert uploaded photo into local state
        setPhotos(prev => [data.photo, ...prev]);
        setToast({ text: 'Photo uploaded and shared with family! ✨', type: 'success' });
      } else {
        // Standalone offline mode: save to IndexedDB
        // Reader is loaded, save base64 URL directly
        const localPhotoObj = {
          id: Date.now().toString(),
          filename: selectedFile.name,
          url: previewUrl, // contains the DataURI base64 string
          guestName: guestName.trim() || 'Guest',
          caption: caption.trim() || '',
          uploadedAt: new Date().toISOString()
        };

        await saveIndexedDBPhoto(localPhotoObj);
        setPhotos(prev => [localPhotoObj, ...prev]);
        setToast({ text: 'Photo saved locally in device archive! 📱', type: 'success' });
      }

      // Reset form fields
      setGuestName('');
      setCaption('');
      setSelectedFile(null);
      setPreviewUrl('');
      // Navigate straight to Album tab to view the picture
      setActiveTab('album');
    } catch (err) {
      console.error(err);
      alert(`Error uploading photo: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBlessingSubmit = async (e) => {
    e.preventDefault();
    if (!guestName.trim()) {
      alert('Please enter your name.');
      return;
    }
    if (!blessingMessage.trim()) {
      alert('Please write your blessing message.');
      return;
    }

    setIsUploading(true);

    try {
      if (backendAvailable) {
        const res = await fetch('/api/blessings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            guestName: guestName.trim(),
            message: blessingMessage.trim()
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || 'Failed to submit blessing');
        }

        const data = await res.json();
        setBlessings(prev => [data.blessing, ...prev]);
        setToast({ text: 'Blessing shared with the family! ❤️', type: 'success' });
      } else {
        const localBlessing = {
          id: Date.now().toString(),
          guestName: guestName.trim(),
          message: blessingMessage.trim(),
          uploadedAt: new Date().toISOString()
        };

        await saveIndexedDBBlessing(localBlessing);
        setBlessings(prev => [localBlessing, ...prev]);
        setToast({ text: 'Blessing card saved locally! 📱', type: 'success' });
      }

      setGuestName('');
      setBlessingMessage('');
      setAlbumView('blessings');
      setActiveTab('album');
    } catch (err) {
      console.error(err);
      alert(`Error sharing blessing: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const generateBlessingCardBlob = (blessing) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');

      // Draw Cream Background
      ctx.fillStyle = '#f8f4eb';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Dual Gold Border
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);

      // Draw Dove Emoji
      ctx.font = '40px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🕊️', canvas.width / 2, 80);

      // Draw Blessing Message text wrapping
      ctx.fillStyle = '#1A365D';
      ctx.font = 'italic 28px "Playfair Display", Georgia, serif';

      const maxTextWidth = 640;
      const lineHeight = 40;
      const startY = 180;

      const words = `"${blessing.message}"`.split(' ');
      let line = '';
      let tempLines = [];
      for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        ctx.font = 'italic 28px "Playfair Display", Georgia, serif';
        let w = ctx.measureText(testLine).width;
        if (w > maxTextWidth && n > 0) {
          tempLines.push(line);
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      tempLines.push(line);

      const totalTextHeight = tempLines.length * lineHeight;
      let adjustedStartY = startY + (300 - startY - totalTextHeight / 2);
      if (adjustedStartY < 140) adjustedStartY = 140;

      for (let i = 0; i < tempLines.length; i++) {
        ctx.fillText(tempLines[i], canvas.width / 2, adjustedStartY + (i * lineHeight));
      }

      // Draw separator
      const sepY = adjustedStartY + totalTextHeight + 40;
      ctx.font = '20px sans-serif';
      ctx.fillText('✨ ✦ ✨', canvas.width / 2, sepY);

      // Draw Guest Name & Date
      ctx.fillStyle = '#1A365D';
      ctx.font = 'bold 22px "Inter", sans-serif';
      ctx.fillText(blessing.guestName, canvas.width / 2, sepY + 60);

      ctx.fillStyle = 'rgba(26, 54, 93, 0.6)';
      ctx.font = '16px "Inter", sans-serif';
      ctx.fillText(new Date(blessing.uploadedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }), canvas.width / 2, sepY + 95);

      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  };

  const generatePhotoCardBlob = (photo) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');

      // Draw Cream Background
      ctx.fillStyle = '#f8f4eb';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Dual Gold Border
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);

      // Draw Guest Image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const boxX = 50;
        const boxY = 50;
        const boxWidth = 700;
        const boxHeight = 525;

        // Maintain aspect ratio cover
        const targetAspect = boxWidth / boxHeight;
        const imageAspect = img.width / img.height;
        let sx, sy, sWidth, sHeight;

        if (imageAspect > targetAspect) {
          sHeight = img.height;
          sWidth = img.height * targetAspect;
          sx = (img.width - sWidth) / 2;
          sy = 0;
        } else {
          sWidth = img.width;
          sHeight = img.width / targetAspect;
          sx = 0;
          sy = (img.height - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, boxX, boxY, boxWidth, boxHeight);

        // Gold border framed around image
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        // Draw captions
        ctx.fillStyle = '#1A365D';
        ctx.textAlign = 'center';

        const captionText = photo.caption ? `"${photo.caption}"` : '"No caption shared."';
        ctx.font = 'italic 26px "Playfair Display", Georgia, serif';
        const maxTextWidth = 640;
        const lineHeight = 38;
        const startTextY = 630;

        const words = captionText.split(' ');
        let line = '';
        let tempLines = [];
        for (let n = 0; n < words.length; n++) {
          let testLine = line + words[n] + ' ';
          ctx.font = 'italic 26px "Playfair Display", Georgia, serif';
          let w = ctx.measureText(testLine).width;
          if (w > maxTextWidth && n > 0) {
            tempLines.push(line);
            line = words[n] + ' ';
          } else {
            line = testLine;
          }
        }
        tempLines.push(line);

        for (let i = 0; i < tempLines.length; i++) {
          ctx.fillText(tempLines[i], canvas.width / 2, startTextY + (i * lineHeight));
        }

        // Draw separator
        const sepY = startTextY + (tempLines.length * lineHeight) + 25;
        ctx.font = '18px sans-serif';
        ctx.fillText('✨ ✦ ✨', canvas.width / 2, sepY);

        // Draw Meta info
        ctx.fillStyle = '#1A365D';
        ctx.font = 'bold 22px "Inter", sans-serif';
        ctx.fillText(`Shared by ${photo.guestName}`, canvas.width / 2, sepY + 50);

        ctx.fillStyle = 'rgba(26, 54, 93, 0.6)';
        ctx.font = '16px "Inter", sans-serif';
        ctx.fillText(new Date(photo.uploadedAt).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }), canvas.width / 2, sepY + 85);

        try {
          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/png');
        } catch (err) {
          console.error('Failed to convert canvas to blob inside load handler:', err);
          resolve(null);
        }
      };

      img.onerror = () => {
        // Fallback layout if image path fails to load natively
        ctx.fillStyle = '#EAEAEA';
        ctx.fillRect(50, 50, 700, 525);
        ctx.fillStyle = '#1a365d';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("Could not load image file", 400, 312);

        // Draw caption anyway
        ctx.font = 'italic 26px "Playfair Display", Georgia, serif';
        ctx.fillText(photo.caption || "No caption shared.", 400, 630);

        // Draw Guest info
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(`Shared by ${photo.guestName}`, 400, 740);

        try {
          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/png');
        } catch (err) {
          console.error('Failed to convert canvas to blob inside error handler:', err);
          resolve(null);
        }
      };

      if (photo.url.startsWith('data:') || photo.url.startsWith('blob:')) {
        img.src = photo.url;
      } else {
        img.src = `/api/proxy-download?url=${encodeURIComponent(photo.url)}&view=true`;
      }
    });
  };

  const shareOrDownloadFile = async (blob, filename) => {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: filename,
          text: 'Save/Share this image!'
        });
        return true;
      } catch (err) {
        console.log('Share/Save cancelled or failed, using download fallback:', err);
      }
    }

    // Default download logic
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
  };

  const handleDownloadSinglePhoto = async (photo) => {
    setToast({ text: 'Preparing photo download... 📥', type: 'info' });
    try {
      const response = await fetch(`/api/proxy-download?url=${encodeURIComponent(photo.url)}`);
      const blob = await response.blob();
      const filename = photo.filename || `nathan-photo-${photo.id}.jpg`;
      await shareOrDownloadFile(blob, filename);
      setToast({ text: 'Download completed! 🎉', type: 'success' });
    } catch (err) {
      console.error('Error saving single photo:', err);
      // Absolute fallback if everything fails
      window.open(photo.url, '_blank');
    }
  };

  const handleDownloadAllPhotos = async () => {
    if (photos.length === 0) return;
    setToast({ text: 'Preparing ZIP archive download... 📦', type: 'info' });
    try {
      const a = document.createElement('a');
      a.href = '/api/download-all-photos';
      a.download = 'Nathan_Baptism_Photos.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setToast({ text: 'Download started! 🎉', type: 'success' });
    } catch (err) {
      console.error('Error downloading photos zip package:', err);
      alert('Could not download photos pack.');
    }
  };

  const handleDownloadAllPhotoCards = async () => {
    if (photos.length === 0) return;
    setToast({ text: 'Generating styled photo cards... 🎨', type: 'info' });
    try {
      const formData = new FormData();
      formData.append('archiveName', 'Nathan_Photos_as_Cards.zip');

      for (let i = 0; i < photos.length; i++) {
        try {
          const blob = await generatePhotoCardBlob(photos[i]);
          if (blob) {
            const filename = `Nathan_PhotoCard_by_${photos[i].guestName.replace(/\s+/g, '_')}_${photos[i].id}.png`;
            formData.append('files', blob, filename);
          }
        } catch (singleErr) {
          console.error(`Error generating photo card index ${i}:`, singleErr);
        }
      }

      setToast({ text: 'Compiling archive package... 📦', type: 'info' });
      const res = await fetch('/api/compile-zip', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Failed to assemble zip package on server');

      const archiveBlob = await res.blob();
      const zipUrl = URL.createObjectURL(archiveBlob);

      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = 'Nathan_Photos_as_Cards.zip';
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        URL.revokeObjectURL(zipUrl);
        document.body.removeChild(a);
      }, 100);

      setToast({ text: 'All shared photo cards saved! 🖼️', type: 'success' });
    } catch (err) {
      console.error('Error generating photo cards:', err);
      alert('Failed to generate cards.');
    }
  };

  const handleDownloadSingleBlessingCard = async (blessing) => {
    setToast({ text: 'Generating blessing card... 🕊️', type: 'info' });
    try {
      const blob = await generateBlessingCardBlob(blessing);
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `Nathan_Blessing_from_${blessing.guestName.replace(/\s+/g, '_')}_${blessing.id}.png`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      setToast({ text: 'Blessing card saved! ❤️', type: 'success' });
    } catch (err) {
      console.error('Error exporting single blessing card:', err);
      alert('Failed to download card.');
    }
  };

  const handleDownloadAllBlessingCards = async () => {
    if (blessings.length === 0) return;
    setToast({ text: 'Generating all blessing cards... 🕊️', type: 'info' });
    try {
      const formData = new FormData();
      formData.append('archiveName', 'Nathan_Blessing_Cards.zip');

      for (let i = 0; i < blessings.length; i++) {
        const blob = await generateBlessingCardBlob(blessings[i]);
        const filename = `Nathan_Blessing_from_${blessings[i].guestName.replace(/\s+/g, '_')}_${blessings[i].id}.png`;
        formData.append('files', blob, filename);
      }

      setToast({ text: 'Compiling archive package... 📦', type: 'info' });
      const res = await fetch('/api/compile-zip', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Failed to assemble zip package on server');

      const archiveBlob = await res.blob();
      const zipUrl = URL.createObjectURL(archiveBlob);

      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = 'Nathan_Blessing_Cards.zip';
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        URL.revokeObjectURL(zipUrl);
        document.body.removeChild(a);
      }, 100);

      setToast({ text: 'All blessing cards saved! 🕊️❤️', type: 'success' });
    } catch (err) {
      console.error('Error generating blessing cards:', err);
      alert('Failed to export all blessing cards.');
    }
  };

  const handleDownloadBlessings = () => {
    if (blessings.length === 0) return;

    try {
      const headers = ['Guest Name', 'Blessing Message', 'Timestamp'];
      const rows = blessings.map(b => [
        `"${b.guestName.replace(/"/g, '""')}"`,
        `"${b.message.replace(/"/g, '""')}"`,
        `"${new Date(b.uploadedAt).toLocaleString()}"`
      ]);

      const csvString = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Nathan_Kelvin_Baptism_Blessings.csv`);
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 100);

      setToast({ text: 'Exported blessings successfully! 📝', type: 'success' });
    } catch (err) {
      console.error('Error exporting blessings:', err);
      alert('Could not export blessings database.');
    }
  };

  // Lightbox navigation helpers
  const handlePrevPhoto = (e) => {
    e.stopPropagation();
    if (lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    } else {
      setLightboxIndex(photos.length - 1); // loop to end
    }
  };

  const handleNextPhoto = (e) => {
    e.stopPropagation();
    if (lightboxIndex < photos.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    } else {
      setLightboxIndex(0); // loop to start
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return '';
    }
  };

  return (
    <>
      {/* Background audio track */}
      <audio
        ref={audioRef}
        src="/lullaby.ogg"
        loop
      />

      {isAdminMode ? (
        <div className="admin-dashboard-container" style={{
          minHeight: '100vh',
          backgroundColor: '#f7fafc',
          padding: '40px 20px',
          fontFamily: 'system-ui, sans-serif',
          color: '#2d3748',
          boxSizing: 'border-box'
        }}>
          <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0',
            padding: '30px',
            position: 'relative'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #edf2f7',
              paddingBottom: '20px',
              marginBottom: '30px'
            }}>
              <div>
                <h1 style={{
                  fontFamily: 'Playfair Display, serif',
                  fontSize: '28px',
                  color: 'var(--deep-blue)',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <Lock size={24} color="var(--primary-gold)" /> Admin Control Panel
                </h1>
                <p style={{ margin: '5px 0 0', color: '#718096', fontSize: '14px' }}>
                  Manage guest-uploaded photos and blessings lists
                </p>
              </div>
              <button
                onClick={() => {
                  sessionStorage.removeItem('admin_pin');
                  setIsAdminAuthenticated(false);
                  setIsAdminMode(false);
                  setAdminPinInput('');
                  window.location.hash = '';
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#edf2f7',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  color: '#4a5568',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#e2e8f0'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#edf2f7'}
              >
                Exit Control Panel
              </button>
            </div>

            {/* Authentication Prompt */}
            {!isAdminAuthenticated ? (
              <div style={{
                maxWidth: '400px',
                margin: '80px auto',
                padding: '30px',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  backgroundColor: 'rgba(212, 175, 55, 0.1)',
                  borderRadius: '50%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  margin: '0 auto 20px'
                }}>
                  <Lock size={28} color="#D4AF37" />
                </div>
                <h2 style={{ fontSize: '20px', color: 'var(--deep-blue)', marginBottom: '10px' }}>Enter Admin Passcode</h2>
                <p style={{ color: '#718096', fontSize: '14px', marginBottom: '20px' }}>
                  Please enter your passcode PIN to access administrative controls.
                </p>
                <form onSubmit={handleVerifyPin}>
                  <input
                    type="password"
                    placeholder="Passcode PIN"
                    value={adminPinInput}
                    onChange={(e) => setAdminPinInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e0',
                      boxSizing: 'border-box',
                      fontSize: '16px',
                      textAlign: 'center',
                      letterSpacing: '3px',
                      marginBottom: '15px'
                    }}
                    autoFocus
                  />
                  <button
                    type="submit"
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: 'var(--deep-blue)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Unlock Panel
                  </button>
                </form>
              </div>
            ) : (
              /* Authenticated Control View */
              <div>
                {/* Stats Dashboard */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px',
                  marginBottom: '40px'
                }}>
                  <div style={{
                    backgroundColor: '#ebf8ff',
                    padding: '20px',
                    borderRadius: '12px',
                    borderLeft: '4px solid #3182ce',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '14px', color: '#2b6cb0', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Photos</h3>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2b6cb0', marginTop: '5px' }}>{photos.length}</div>
                  </div>
                  <div style={{
                    backgroundColor: '#faf5ff',
                    padding: '20px',
                    borderRadius: '12px',
                    borderLeft: '4px solid #805ad5',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '14px', color: '#6b46c1', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Blessings</h3>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#6b46c1', marginTop: '5px' }}>{blessings.length}</div>
                  </div>
                  <div style={{
                    backgroundColor: '#fffaf0',
                    padding: '20px',
                    borderRadius: '12px',
                    borderLeft: '4px solid var(--primary-gold)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '10px'
                  }}>
                    <h3 style={{ margin: '0 0 5px', fontSize: '14px', color: '#b7791f', textTransform: 'uppercase', letterSpacing: '1px' }}>Export Actions</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        onClick={handleDownloadAllPhotos}
                        disabled={photos.length === 0}
                        style={{
                          padding: '8px 4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor: '#3182ce',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: photos.length === 0 ? 'not-allowed' : 'pointer',
                          opacity: photos.length === 0 ? 0.6 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <Download size={11} /> Photos Only
                      </button>
                      <button
                        onClick={handleDownloadAllPhotoCards}
                        disabled={photos.length === 0}
                        style={{
                          padding: '8px 4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor: '#d69e2e',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: photos.length === 0 ? 'not-allowed' : 'pointer',
                          opacity: photos.length === 0 ? 0.6 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <Download size={11} /> Photos as Cards
                      </button>
                      <button
                        onClick={handleDownloadBlessings}
                        disabled={blessings.length === 0}
                        style={{
                          padding: '8px 4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor: '#805ad5',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: blessings.length === 0 ? 'not-allowed' : 'pointer',
                          opacity: blessings.length === 0 ? 0.6 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <Download size={11} /> Blessings CSV
                      </button>
                      <button
                        onClick={handleDownloadAllBlessingCards}
                        disabled={blessings.length === 0}
                        style={{
                          padding: '8px 4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor: '#e53e3e',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: blessings.length === 0 ? 'not-allowed' : 'pointer',
                          opacity: blessings.length === 0 ? 0.6 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <Download size={11} /> Blessings as Cards
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '40px' }}>
                  <h2 style={{
                    fontFamily: 'Playfair Display, serif',
                    fontSize: '22px',
                    color: 'var(--deep-blue)',
                    borderBottom: '1px solid #edf2f7',
                    paddingBottom: '10px',
                    marginBottom: '20px'
                  }}>
                    Uploaded Photos ({photos.length})
                  </h2>

                  {photos.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '40px',
                      color: '#a0aec0',
                      border: '2px dashed #e2e8f0',
                      borderRadius: '12px'
                    }}>
                      No photos uploaded yet.
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                      gap: '20px'
                    }}>
                      {photos.map(photo => (
                        <div key={photo.id} style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          overflow: 'hidden',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          <div style={{ position: 'relative', paddingTop: '75%', backgroundColor: '#f7fafc' }}>
                            <img
                              src={photo.url}
                              alt={photo.caption}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                            />
                          </div>
                          <div style={{ padding: '15px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--deep-blue)' }}>
                                By: {photo.guestName}
                              </p>
                              {photo.caption && (
                                <p style={{ margin: '5px 0 0', fontSize: '13px', color: '#4a5568', fontStyle: 'italic' }}>
                                  "{photo.caption}"
                                </p>
                              )}
                              <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#a0aec0' }}>
                                {formatDate(photo.uploadedAt)}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeletePhoto(photo.id)}
                              style={{
                                marginTop: '15px',
                                width: '100%',
                                padding: '8px',
                                backgroundColor: '#fff5f5',
                                border: '1px solid #fed7d7',
                                color: '#e53e3e',
                                borderRadius: '6px',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = '#fff0f0';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = '#fff5f5';
                              }}
                            >
                              <Trash2 size={14} /> Delete Photo
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Blessings Admin List */}
                <div>
                  <h2 style={{
                    fontFamily: 'Playfair Display, serif',
                    fontSize: '22px',
                    color: 'var(--deep-blue)',
                    borderBottom: '1px solid #edf2f7',
                    paddingBottom: '10px',
                    marginBottom: '20px'
                  }}>
                    Guest Blessings ({blessings.length})
                  </h2>

                  {blessings.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '30px',
                      color: '#a0aec0',
                      border: '2px dashed #e2e8f0',
                      borderRadius: '12px'
                    }}>
                      No blessings received yet.
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '15px'
                    }}>
                      {blessings.map(b => (
                        <div key={b.id} style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          padding: '15px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '20px'
                        }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--deep-blue)' }}>
                              {b.guestName}
                            </p>
                            <p style={{ margin: '5px 0 0', fontSize: '14px', color: '#4a5568' }}>
                              {b.message}
                            </p>
                            <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#a0aec0' }}>
                              {formatDate(b.uploadedAt)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteBlessing(b.id)}
                            style={{
                              padding: '10px',
                              backgroundColor: '#fff5f5',
                              border: '1px solid #fed7d7',
                              color: '#e53e3e',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'background-color 0.2s'
                            }}
                            title="Delete Blessing"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Floating Sparkles & Details */}
          <div className="sparkle" style={{ top: '15%', left: '10%', animationDelay: '0.2s' }}><Sparkles size={16} /></div>
          <div className="sparkle" style={{ top: '25%', right: '15%', animationDelay: '1s' }}><Sparkles size={20} /></div>
          <div className="sparkle" style={{ bottom: '20%', left: '5%', animationDelay: '1.8s' }}><Sparkles size={14} /></div>
          <div className="sparkle" style={{ bottom: '15%', right: '12%', animationDelay: '0.6s' }}><Sparkles size={18} /></div>

          {/* Audio Playback Floating Control */}
          <button
            className={`bg-music-toggle ${isPlayingMusic ? 'music-playing' : ''}`}
            onClick={toggleMusic}
            title={isPlayingMusic ? 'Mute Music' : 'Play Background Music'}
            aria-label="Toggle background music"
          >
            {isPlayingMusic ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>

          {/* App Header (Brand, Navigation desktop layout) */}
          <header className="main-header">
            <div className="brand-section">
              <div className="brand-logo-icon">
                <Heart size={20} color="white" fill="white" />
              </div>
              <span className="brand-title">Nathan's Baptism</span>
            </div>

            <nav className="nav-links">
              <a
                className={`nav-link ${activeTab === 'invitation' ? 'active' : ''}`}
                onClick={() => setActiveTab('invitation')}
              >
                Home
              </a>
              <a
                className={`nav-link ${activeTab === 'album' ? 'active' : ''}`}
                onClick={() => setActiveTab('album')}
              >
                Photo Album
              </a>
              <a
                className={`nav-link ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => setActiveTab('upload')}
              >
                <Upload size={16} /> Upload Photo
              </a>
            </nav>
          </header>

          {/* Main Page Content */}
          <main className="app-container">

            {/* Tab 1: Interactive Animated Invitation */}
            {activeTab === 'invitation' && (
              <div style={{ animation: 'fadeIn 0.5s ease' }}>

                {!isEnvelopeOpened ? (
                  /* Envelope Closed State */
                  <div
                    className="invitation-envelope"
                    style={{ cursor: 'pointer', textAlign: 'center' }}
                    onClick={handleOpenEnvelope}
                  >
                    <div
                      className="envelope-card"
                      style={{
                        background: 'linear-gradient(135deg, #1A365D 0%, #152b52 100%)',
                        color: '#FAF6F0',
                        border: '2px solid rgba(212, 175, 55, 0.4)',
                        boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                        transform: 'translateY(20px)'
                      }}
                    >
                      <div className="church-border" style={{ borderColor: 'rgba(212, 175, 55, 0.4)' }} />

                      <div style={{ marginTop: '20px', marginBottom: '30px' }}>
                        <Heart size={44} color="#D4AF37" fill="#D4AF37" style={{ margin: '0 auto 10px', filter: 'drop-shadow(0 2px 8px rgba(212,175,55,0.4))' }} />
                        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '32px', color: '#FFF', fontWeight: 600, letterSpacing: '1px' }}>Nathan Kelvin</h2>
                        <p style={{ color: '#D4AF37', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontStyle: 'italic', marginTop: '5px' }}>Holy Baptism Invitation</p>
                      </div>

                      <div style={{ margin: '40px auto 10px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEnvelope();
                          }}
                          style={{
                            background: 'var(--gold-gradient)',
                            color: 'var(--navy)',
                            border: 'none',
                            padding: '14px 28px',
                            borderRadius: '35px',
                            fontFamily: 'Montserrat, sans-serif',
                            fontWeight: 700,
                            fontSize: '15px',
                            boxShadow: '0 8px 24px rgba(212, 175, 55, 0.4)',
                            cursor: 'pointer',
                            transition: '0.2s',
                            letterSpacing: '1px'
                          }}
                          onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                          onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                        >
                          OPEN INVITATION
                        </button>
                      </div>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '20px' }}>Tap to open and play music</p>
                    </div>
                  </div>
                ) : (
                  /* Envelope Opened Invitation Reveal */
                  <div>
                    <div className="invitation-envelope">
                      <div className="envelope-card">
                        <div className="church-border" />

                        <p className="invitation-intro">With joyful hearts, we invite you to the Holy Baptism ceremony of our son</p>

                        <div className="baby-name">
                          NATHAN KELVIN
                          <span>August 2nd, 2026</span>
                        </div>

                        <div className="invitation-baptism-title">Holy Baptism</div>

                        <div className="invite-details-box">
                          <div className="invite-detail-item">
                            <div className="detail-label">Service Date & Time</div>
                            <div className="detail-value">Sunday, August 2nd</div>
                            <div className="detail-info">At 11:45 AM</div>
                          </div>

                          <div className="invite-detail-item" style={{ marginTop: '25px' }}>
                            <div className="detail-label">Ceremonial Venue</div>
                            <div className="detail-value">St. Joseph's Church</div>
                            <div className="detail-info">Chunangamvely, Aluva, Kerala</div>
                          </div>

                          <div className="invite-detail-item" style={{ marginTop: '25px' }}>
                            <div className="detail-label">Reception to follow</div>
                            <div className="detail-value">Church Parish Hall</div>
                            <div className="detail-info">Immediately after the ceremony</div>
                          </div>
                        </div>

                        <p className="invite-footer">Your presence and blessings are our greatest gifts.</p>

                        <div className="invite-hosts" style={{ marginTop: '20px', borderTop: '1px solid rgba(212, 175, 55, 0.25)', paddingTop: '15px' }}>
                          <p style={{
                            fontFamily: 'Cormorant Garamond, serif',
                            fontSize: '14px',
                            textTransform: 'uppercase',
                            letterSpacing: '2px',
                            color: 'var(--text-muted)',
                            margin: 0
                          }}>With love,</p>
                          <p style={{
                            fontFamily: 'Playfair Display, serif',
                            fontSize: '20px',
                            fontWeight: 600,
                            color: 'var(--deep-blue)',
                            marginTop: '5px',
                            marginBottom: 0
                          }}>Kelvin & Rosanna</p>
                        </div>
                      </div>
                    </div>

                    {/* Countdown to Ceremony */}
                    <div style={{ textAlign: 'center', marginTop: '30px', marginBottom: '30px' }}>
                      <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', color: 'var(--deep-blue)', marginBottom: '15px' }}>
                        {timeLeft.isOver ? 'Celebration Day! 🎉' : 'Countdown to Ceremony'}
                      </h3>

                      {!timeLeft.isOver ? (
                        <div className="countdown-container">
                          <div className="countdown-box">
                            <div className="countdown-number">{timeLeft.days}</div>
                            <div className="countdown-label">Days</div>
                          </div>
                          <div className="countdown-box">
                            <div className="countdown-number">{timeLeft.hours}</div>
                            <div className="countdown-label">Hours</div>
                          </div>
                          <div className="countdown-box">
                            <div className="countdown-number">{timeLeft.minutes}</div>
                            <div className="countdown-label">Min</div>
                          </div>
                          <div className="countdown-box">
                            <div className="countdown-number">{timeLeft.seconds}</div>
                            <div className="countdown-label">Sec</div>
                          </div>
                        </div>
                      ) : (
                        <p style={{ fontStyle: 'italic', color: 'var(--primary-gold)', fontWeight: 600 }}>
                          Today, Nathan walks in the light of God. Welcome!
                        </p>
                      )}
                    </div>

                    {/* Location / Google Map Details */}
                    <div className="location-section">
                      {/* Church Map Card */}
                      <div className="info-card">
                        <div>
                          <div className="info-card-header">
                            <div className="info-card-icon">
                              <MapPin size={24} />
                            </div>
                            <div className="info-card-title">St. Joseph's Church</div>
                          </div>
                          <p style={{ fontSize: '14px', marginBottom: '20px' }}>
                            Located in Chunangamvely, Erumathala, Aluva. It's approximately 500 meters from Rajagiri Hospital.
                          </p>
                        </div>
                        <div>
                          <div className="map-container">
                            <iframe
                              src="https://maps.google.com/maps?q=St%20Joseph's%20Church%20Chunangamvely%20Aluva&t=&z=15&ie=UTF8&iwloc=&output=embed"
                              width="100%"
                              height="250"
                              style={{ border: 0 }}
                              allowFullScreen=""
                              loading="lazy"
                              title="St Joseph's Church Map"
                            />
                          </div>
                          <a
                            href="https://www.google.com/maps/search/?api=1&query=St+Joseph's+Church+Chunangamvely+Aluva"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="external-map-link"
                          >
                            <Map size={16} /> Open in Google Maps app
                          </a>
                        </div>
                      </div>

                      {/* Parish Hall Reception Card */}
                      <div className="info-card">
                        <div>
                          <div className="info-card-header">
                            <div className="info-card-icon" style={{ background: 'var(--bg-cream)', color: 'var(--primary-gold)' }}>
                              <Smile size={24} />
                            </div>
                            <div className="info-card-title">After Ceremony Reception</div>
                          </div>
                          <p style={{ fontSize: '14px', marginBottom: '20px' }}>
                            The celebration and lunch will follow immediately right inside the Parish Hall, located inside the church premises.
                          </p>
                        </div>
                        <div style={{ background: 'rgba(212, 175, 55, 0.05)', borderRadius: 'var(--border-radius-md)', padding: '24px 20px', border: '1px solid rgba(212, 175, 55, 0.1)', textAlign: 'center' }}>
                          <div style={{ fontSize: '36px', marginBottom: '10px' }}>🍴🍸🍰</div>
                          <h4 style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', color: 'var(--deep-blue)', marginBottom: '8px' }}>Celebrate With Us</h4>
                          <p style={{ fontSize: '13px', margin: 0 }}>
                            Join us for lunch, photography and cake cutting! Let's take wonderful family memories together.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Nathan's Early Milestones Polaroid Strip */}
                    <div className="milestones-section">
                      <h3 className="milestones-title">✦ Nathan's Tiny Milestones ✦</h3>
                      <p className="milestones-subtitle">Beautiful snapshots of our bundle of joy on his early journey.</p>

                      <div className="polaroid-grid">
                        <div className="polaroid-card card-tilt-left-sweet">
                          <div className="polaroid-image-wrapper">
                            <img src="/milestones/maternity.jpg" alt="Maternity photoshoot" />
                          </div>
                          <div className="polaroid-caption">The Waiting Days</div>
                        </div>

                        <div className="polaroid-card card-tilt-right-sweet">
                          <div className="polaroid-image-wrapper">
                            <img src="/milestones/first_pic.jpg" alt="Baby's first picture" />
                          </div>
                          <div className="polaroid-caption">First Hello</div>
                        </div>

                        <div className="polaroid-card card-tilt-left-strong">
                          <div className="polaroid-image-wrapper">
                            <img src="/milestones/newborn_1.jpg" alt="Newborn sleeping photoshoot" />
                          </div>
                          <div className="polaroid-caption">Newborn Sweetness</div>
                        </div>

                        <div className="polaroid-card card-tilt-right-strong">
                          <div className="polaroid-image-wrapper">
                            <img src="/milestones/newborn_2.jpg" alt="Newborn swaddled photoshoot" />
                          </div>
                          <div className="polaroid-caption">Little Gentleman</div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

              </div>
            )}

            {/* Tab 2: Guest Photo Album & Wishes */}
            {activeTab === 'album' && (
              <div style={{ animation: 'fadeIn 0.5s ease' }}>
                <div className="page-title-section">
                  <h2 className="page-title">Nathan's Memory Wall</h2>
                  <p className="page-subtitle">
                    A collection of beautiful moments and warm wishes shared by our guests.
                  </p>
                </div>

                {/* Network Online/Offline indicator */}
                {!backendAvailable && (
                  <div className="status-banner">
                    <Database size={16} />
                    <span>
                      <strong>Offline Sandbox Mode:</strong> Blessings and photos are saved locally to IndexedDB. Run backend server for live sync.
                    </span>
                  </div>
                )}

                {/* Segmented View Control */}
                <div className="segment-control-wrapper">
                  <button
                    className={`segment-btn ${albumView === 'photos' ? 'active' : ''}`}
                    onClick={() => setAlbumView('photos')}
                  >
                    <ImageIcon size={16} style={{ marginRight: '6px' }} />
                    Photo Gallery ({photos.length})
                  </button>
                  <button
                    className={`segment-btn ${albumView === 'blessings' ? 'active' : ''}`}
                    onClick={() => setAlbumView('blessings')}
                  >
                    <Heart size={16} style={{ marginRight: '6px' }} />
                    Guestbook Blessings ({blessings.length})
                  </button>
                </div>

                {/* Section Actions (Public users get a single Download Photos button for convenience; admin gets advanced features) */}
                <div className="section-actions-wrapper">
                  {albumView === 'photos' && photos.length > 0 && (
                    <button
                      onClick={handleDownloadAllPhotos}
                      className="btn-export-option"
                      title="Download all guest photos"
                    >
                      <Download size={14} style={{ marginRight: '6px' }} />
                      Download All Photos
                    </button>
                  )}
                </div>

                {albumView === 'photos' ? (
                  isLoadingPhotos ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                      <div style={{ width: '40px', height: '40px', border: '3px solid var(--sky-blue)', borderTopColor: 'var(--primary-gold)', borderRadius: '50%', animation: 'rotateMusic 1s infinite linear', margin: '0 auto 15px' }} />
                      <p>Loading photo gallery...</p>
                    </div>
                  ) : photos.length === 0 ? (
                    <div className="info-card" style={{ padding: '50px 30px', textAlign: 'center', alignItems: 'center' }}>
                      <ImageIcon size={48} color="var(--primary-gold)" style={{ opacity: 0.7, marginBottom: '15px' }} />
                      <h3 style={{ fontFamily: 'Playfair Display, serif', color: 'var(--deep-blue)', marginBottom: '10px' }}>No Photos Yet</h3>
                      <p style={{ maxWidth: '400px', margin: '0 auto 20px', fontSize: '14px' }}>
                        Be the first one to share a beautiful snapshot of baby Nathan! Tap the upload tab to post a picture.
                      </p>
                      <button
                        onClick={() => {
                          setUploadType('photo');
                          setActiveTab('upload');
                        }}
                        className="btn-upload-submit"
                        style={{ background: 'var(--primary-gold)', color: 'var(--navy)', width: 'auto', padding: '12px 24px' }}
                      >
                        <Upload size={16} /> Upload Now
                      </button>
                    </div>
                  ) : (
                    <div className="album-feed">
                      {photos.map((photo, index) => (
                        <div key={photo.id} className="photo-card">
                          <div
                            className="photo-image-wrapper"
                            onClick={() => setLightboxIndex(index)}
                          >
                            <img
                              src={photo.url}
                              alt={photo.caption || 'Baptism memory'}
                              className="photo-image"
                              loading="lazy"
                            />
                          </div>
                          <div className="photo-details">
                            <p className="photo-caption">
                              {photo.caption ? `"${photo.caption}"` : 'No message written.'}
                            </p>

                            <div className="photo-meta">
                              <div className="photo-guest">
                                <Heart size={14} fill="var(--primary-gold)" color="var(--primary-gold)" />
                                <span>{photo.guestName}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadSinglePhoto(photo);
                                  }}
                                  className="photo-download-btn"
                                  title="Download/Save Photo"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    transition: 'color 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-gold)'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                                >
                                  <Download size={14} />
                                </button>
                                <span className="photo-time">
                                  {formatDate(photo.uploadedAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  /* Blessings/Wishes List View */
                  isLoadingBlessings ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                      <div style={{ width: '40px', height: '40px', border: '3px solid var(--sky-blue)', borderTopColor: 'var(--primary-gold)', borderRadius: '50%', animation: 'rotateMusic 1s infinite linear', margin: '0 auto 15px' }} />
                      <p>Loading blessings...</p>
                    </div>
                  ) : blessings.length === 0 ? (
                    <div className="info-card" style={{ padding: '50px 30px', textAlign: 'center', alignItems: 'center' }}>
                      <Heart size={48} color="var(--primary-gold)" style={{ opacity: 0.7, marginBottom: '15px' }} />
                      <h3 style={{ fontFamily: 'Playfair Display, serif', color: 'var(--deep-blue)', marginBottom: '10px' }}>No Blessings Yet</h3>
                      <p style={{ maxWidth: '400px', margin: '0 auto 20px', fontSize: '14px' }}>
                        Send a warm prayer or congratulatory blessing for baby Nathan! Tap write blessing to add your memory.
                      </p>
                      <button
                        onClick={() => {
                          setUploadType('blessing');
                          setActiveTab('upload');
                        }}
                        className="btn-upload-submit"
                        style={{ background: 'var(--primary-gold)', color: 'var(--navy)', width: 'auto', padding: '12px 24px' }}
                      >
                        ✍️ Write a Blessing
                      </button>
                    </div>
                  ) : (
                    <div className="blessings-grid-layout">
                      {blessings.map((blessing) => (
                        <div key={blessing.id} className="blessing-card-element">
                          <div className="blessing-decorator">🕊️</div>
                          <p className="blessing-text-body">"{blessing.message}"</p>
                          <div className="blessing-footer">
                            <span className="blessing-author-label">{blessing.guestName}</span>
                            <span className="blessing-date-label">{formatDate(blessing.uploadedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            )}

            {/* Tab 3: Upload Photo module */}
            {activeTab === 'upload' && (
              <div style={{ animation: 'fadeIn 0.5s ease' }}>
                <div className="page-title-section">
                  <h2 className="page-title">Share Your Memories</h2>
                  <p className="page-subtitle">
                    Help us capture every smile! Take a picture or choose a photo from your gallery to add to Nathan's baptism album.
                  </p>
                </div>

                {/* Segmented Share Type Control */}
                <div className="segment-control-wrapper" style={{ margin: '0 auto 25px', maxWidth: '480px' }}>
                  <button
                    className={`segment-btn ${uploadType === 'photo' ? 'active' : ''}`}
                    onClick={() => setUploadType('photo')}
                    type="button"
                  >
                    <Camera size={16} style={{ marginRight: '6px' }} />
                    Share a Photo
                  </button>
                  <button
                    className={`segment-btn ${uploadType === 'blessing' ? 'active' : ''}`}
                    onClick={() => setUploadType('blessing')}
                    type="button"
                  >
                    <Heart size={16} style={{ marginRight: '6px' }} />
                    Write Blessing
                  </button>
                </div>

                <div className="upload-card">
                  {uploadType === 'photo' ? (
                    /* Photo Upload Form */
                    <form onSubmit={handlePhotoUpload} className="upload-form">
                      {/* Upload drag-n-drop file picker */}
                      {!previewUrl ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                          <div
                            onClick={() => document.getElementById('camera-photo-picker').click()}
                            style={{
                              padding: '24px 15px',
                              borderRadius: 'var(--border-radius-md)',
                              background: 'rgba(232, 241, 245, 0.5)',
                              border: '1.5px dashed rgba(212, 175, 55, 0.4)',
                              textAlign: 'center',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'background-color 0.2s'
                            }}
                          >
                            <div className="upload-icon-wrapper" style={{ margin: '0 0 10px' }}>
                              <Camera size={24} />
                            </div>
                            <h4 style={{ color: 'var(--deep-blue)', marginBottom: '4px', fontSize: '14px' }}>Take Photo</h4>
                            <p style={{ fontSize: '11px', margin: 0, color: 'var(--text-muted)' }}>
                              Use camera
                            </p>
                          </div>

                          <div
                            onClick={() => document.getElementById('gallery-photo-picker').click()}
                            style={{
                              padding: '24px 15px',
                              borderRadius: 'var(--border-radius-md)',
                              background: 'rgba(232, 241, 245, 0.5)',
                              border: '1.5px dashed rgba(212, 175, 55, 0.4)',
                              textAlign: 'center',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'background-color 0.2s'
                            }}
                          >
                            <div className="upload-icon-wrapper" style={{ margin: '0 0 10px' }}>
                              <ImageIcon size={24} />
                            </div>
                            <h4 style={{ color: 'var(--deep-blue)', marginBottom: '4px', fontSize: '14px' }}>From Gallery</h4>
                            <p style={{ fontSize: '11px', margin: 0, color: 'var(--text-muted)' }}>
                              Choose image
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center' }}>
                          <div className="image-preview-box">
                            <img src={previewUrl} alt="Preview" className="image-preview-img" />
                            <button
                              type="button"
                              className="image-preview-remove"
                              onClick={removeSelectedFile}
                              title="Remove image"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Image ready for upload</p>
                        </div>
                      )}

                      <input
                        type="file"
                        id="camera-photo-picker"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                      <input
                        type="file"
                        id="gallery-photo-picker"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />

                      <div className="form-group">
                        <label className="form-label" htmlFor="guest-name">Your Name</label>
                        <input
                          type="text"
                          id="guest-name"
                          placeholder="e.g. Aunt Jis or Uncle Chris"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          className="form-input"
                          maxLength={35}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="blessing-msg">Warm Blessings / Wishes</label>
                        <textarea
                          id="blessing-msg"
                          placeholder="May God bless you with a life filled with joy and grace!"
                          value={caption}
                          onChange={(e) => setCaption(e.target.value)}
                          className="form-input"
                          style={{ minHeight: '80px', resize: 'vertical' }}
                          maxLength={150}
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn-upload-submit"
                        disabled={isUploading || !selectedFile}
                      >
                        {isUploading ? (
                          <>
                            <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'rotateMusic 1s infinite linear', marginRight: '8px' }} />
                            Uploading Photo...
                          </>
                        ) : (
                          <>
                            <Upload size={18} style={{ marginRight: '8px' }} />
                            Share Album Photo
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    /* Text-only Blessing Form */
                    <form onSubmit={handleBlessingSubmit} className="upload-form">
                      <div className="form-group">
                        <label className="form-label" htmlFor="blessing-guest-name">Your Name</label>
                        <input
                          type="text"
                          id="blessing-guest-name"
                          placeholder="e.g. Aunt Jis or Uncle Chris"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          className="form-input"
                          maxLength={35}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="blessing-text-msg">Your Blessing / Wish</label>
                        <textarea
                          id="blessing-text-msg"
                          placeholder="Wishing baby Nathan a beautiful journey of faith, and a life filled with love, laughter, and happiness. God bless your family!"
                          value={blessingMessage}
                          onChange={(e) => setBlessingMessage(e.target.value)}
                          className="form-input"
                          style={{ minHeight: '120px', resize: 'vertical' }}
                          maxLength={250}
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn-upload-submit"
                        disabled={isUploading || !guestName.trim() || !blessingMessage.trim()}
                      >
                        {isUploading ? (
                          <>
                            <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'rotateMusic 1s infinite linear', marginRight: '8px' }} />
                            Sharing Blessing...
                          </>
                        ) : (
                          <>
                            <Heart size={18} style={{ marginRight: '8px' }} />
                            Share Blessing
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

          </main>

          {/* Floating Toast notification popup */}
          {toast && (
            <div className="toast-msg">
              <CheckCircle size={18} color="#D4AF37" />
              <span>{toast.text}</span>
            </div>
          )}

          {/* Fullscreen Photo Lightbox Modal */}
          {lightboxIndex !== null && photos.length > 0 && (
            <div className="lightbox-modal" onClick={() => setLightboxIndex(null)}>
              <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '15px', zIndex: 1200 }}>
                  <button
                    onClick={() => handleDownloadSinglePhoto(photos[lightboxIndex])}
                    className="lightbox-download-action"
                    title="Save Photo"
                    style={{
                      color: 'white',
                      background: 'rgba(0,0,0,0.5)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.8)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.5)'}
                  >
                    <Download size={20} />
                  </button>
                  <button
                    className="lightbox-close"
                    onClick={() => setLightboxIndex(null)}
                    style={{ position: 'static', margin: 0 }}
                  >
                    &times;
                  </button>
                </div>

                <img
                  src={photos[lightboxIndex].url}
                  alt="Expanded Memory"
                  className="lightbox-image"
                />

                <div className="lightbox-caption-area">
                  <p className="lightbox-caption">
                    {photos[lightboxIndex].caption ? `"${photos[lightboxIndex].caption}"` : ''}
                  </p>
                  <div className="lightbox-meta">
                    Posted by <strong style={{ color: 'white' }}>{photos[lightboxIndex].guestName}</strong>
                    {photos[lightboxIndex].uploadedAt && ` on ${formatDate(photos[lightboxIndex].uploadedAt)}`}
                  </div>
                </div>

                {/* Lightbox navigation */}
                {photos.length > 1 && (
                  <>
                    <button className="lightbox-nav-btn lightbox-prev" onClick={handlePrevPhoto}>
                      <ChevronLeft size={30} />
                    </button>
                    <button className="lightbox-nav-btn lightbox-next" onClick={handleNextPhoto}>
                      <ChevronRight size={30} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Bottom Sticky Navigation (for Mobile viewport compatibility) */}
          <div className="mobile-nav">
            <div
              className={`mobile-nav-item ${activeTab === 'invitation' ? 'active' : ''}`}
              onClick={() => setActiveTab('invitation')}
            >
              <Heart size={20} fill={activeTab === 'invitation' ? 'var(--deep-blue)' : 'none'} />
              <span>Home</span>
            </div>
            <div
              className={`mobile-nav-item ${activeTab === 'album' ? 'active' : ''}`}
              onClick={() => setActiveTab('album')}
            >
              <ImageIcon size={20} fill={activeTab === 'album' ? 'var(--deep-blue)' : 'none'} />
              <span>Album</span>
            </div>
            <div
              className={`mobile-nav-item ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <Upload size={20} />
              <span>Upload</span>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default App;
