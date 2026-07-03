import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { exec } from 'child_process';
import util from 'util';
import os from 'os';
import { ZipArchive } from 'archiver';




// Load environmental variables
dotenv.config();

const __filename = typeof __filename !== 'undefined' 
  ? __filename 
  : (typeof import.meta !== 'undefined' && import.meta.url ? fileURLToPath(import.meta.url) : '');

const __dirname = typeof __dirname !== 'undefined' 
  ? __dirname 
  : (__filename ? path.dirname(__filename) : process.cwd());
const execPromise = util.promisify(exec);


const app = express();
const PORT = process.env.PORT || 5005;

// Enable CORS and body parsing
app.use(cors());
app.use(express.json());

// Log incoming API request details
app.use((req, res, next) => {
  console.log(`[API REQUEST] ${req.method} ${req.url}`);
  next();
});

// Set up directories
const isNetlify = !!process.env.NETLIFY || !!process.env.LAMBDA_TASK_ROOT || __dirname.includes('/var/task') || __dirname.includes('/netlify/functions');

const UPLOADS_DIR = isNetlify 
  ? path.join(os.tmpdir(), 'uploads') 
  : path.join(__dirname, 'uploads');

const DB_FILE = isNetlify 
  ? path.join(os.tmpdir(), 'database.json') 
  : path.join(__dirname, 'database.json');

const BLESSINGS_FILE = isNetlify 
  ? path.join(os.tmpdir(), 'blessings.json') 
  : path.join(__dirname, 'blessings.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploads folder statically
app.use('/uploads', express.static(UPLOADS_DIR));

// R2 Storage Configuration
const isR2Configured = !!(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME &&
  process.env.R2_PUBLIC_URL
);

let r2Client = null;
if (isR2Configured) {
  try {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    console.log('Cloudflare R2 Storage configured and active.');
  } catch (err) {
    console.error('Failed to initialize Cloudflare R2 Client:', err);
  }
} else {
  console.log('Cloudflare R2 credentials not found. Falling back to local file storage.');
}

// Configure multer storage based on config status
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'photo-' + uniqueSuffix + ext);
  }
});

const storageEngine = isR2Configured ? multer.memoryStorage() : diskStorage;

// Help filter only image uploads
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only images are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storageEngine,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Database Keys inside Cloudflare R2 bucket
const DB_KEY = 'data/database.json';
const BLESSINGS_KEY = 'data/blessings.json';

// Helper function to read/write JSON database
const readDB = async () => {
  if (isR2Configured && r2Client) {
    try {
      const response = await r2Client.send(
        new GetObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: DB_KEY,
        })
      );
      const dataStr = await response.Body.transformToString();
      return JSON.parse(dataStr || '[]');
    } catch (err) {
      if (err.name === 'NoSuchKey') {
        console.log('database.json not found on Cloudflare R2. Initializing with local seed or empty array.');
        let seed = [];
        if (fs.existsSync(DB_FILE)) {
          try {
            seed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '[]');
          } catch (_) {}
        }
        await writeDB(seed);
        return seed;
      }
      console.error('Failed to read database.json from R2:', err);
    }
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
    return [];
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error('Error reading DB file, resetting database:', error);
    return [];
  }
};

const writeDB = async (data) => {
  if (isR2Configured && r2Client) {
    try {
      await r2Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: DB_KEY,
          Body: JSON.stringify(data, null, 2),
          ContentType: 'application/json',
        })
      );
      console.log('database.json written to Cloudflare R2 successfully.');
    } catch (err) {
      console.error('Failed to write database.json to Cloudflare R2:', err);
    }
  }

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write database.json to local filesystem:', err);
  }
};

const readBlessings = async () => {
  if (isR2Configured && r2Client) {
    try {
      const response = await r2Client.send(
        new GetObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: BLESSINGS_KEY,
        })
      );
      const dataStr = await response.Body.transformToString();
      return JSON.parse(dataStr || '[]');
    } catch (err) {
      if (err.name === 'NoSuchKey') {
        console.log('blessings.json not found on Cloudflare R2. Initializing with local seed or empty array.');
        let seed = [];
        if (fs.existsSync(BLESSINGS_FILE)) {
          try {
            seed = JSON.parse(fs.readFileSync(BLESSINGS_FILE, 'utf8') || '[]');
          } catch (_) {}
        }
        await writeBlessings(seed);
        return seed;
      }
      console.error('Failed to read blessings.json from R2:', err);
    }
  }

  if (!fs.existsSync(BLESSINGS_FILE)) {
    fs.writeFileSync(BLESSINGS_FILE, JSON.stringify([]));
    return [];
  }
  try {
    const data = fs.readFileSync(BLESSINGS_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error('Error reading blessings file, resetting datastore:', error);
    return [];
  }
};

const writeBlessings = async (data) => {
  if (isR2Configured && r2Client) {
    try {
      await r2Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: BLESSINGS_KEY,
          Body: JSON.stringify(data, null, 2),
          ContentType: 'application/json',
        })
      );
      console.log('blessings.json written to Cloudflare R2 successfully.');
    } catch (err) {
      console.error('Failed to write blessings.json to Cloudflare R2:', err);
    }
  }

  try {
    fs.writeFileSync(BLESSINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write blessings.json to local filesystem:', err);
  }
};

// API Endpoints
// 1. Get all photos
app.get('/api/photos', async (req, res) => {
  try {
    const photos = await readDB();
    res.json({ success: true, count: photos.length, photos: photos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Upload a new photo
app.post('/api/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image file.' });
    }

    const { guestName, caption } = req.body;
    const db = await readDB();
    let imageUrl = '';
    let filename = '';

    if (isR2Configured && r2Client) {
      // Stream to Cloudflare R2
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(req.file.originalname) || '.jpg';
      filename = 'photo-' + uniqueSuffix + ext;
      const key = `photos/${filename}`;

      await r2Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
      );

      const publicUrlBase = process.env.R2_PUBLIC_URL.endsWith('/')
        ? process.env.R2_PUBLIC_URL.slice(0, -1)
        : process.env.R2_PUBLIC_URL;
      imageUrl = `${publicUrlBase}/${key}`;
    } else {
      // Local Server disk storage fallback
      filename = req.file.filename;
      imageUrl = `/uploads/${req.file.filename}`;
    }
    
    const newPhoto = {
      id: Date.now().toString(),
      filename: filename,
      url: imageUrl,
      guestName: guestName || 'Guest',
      caption: caption || '',
      uploadedAt: new Date().toISOString()
    };

    db.unshift(newPhoto); // Add to the top of list
    await writeDB(db);

    res.status(201).json({ success: true, photo: newPhoto });
  } catch (error) {
    console.error('Upload handler failed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Blessings Endpoints
// 1. Get all blessings
app.get('/api/blessings', async (req, res) => {
  try {
    const blessings = await readBlessings();
    res.json({ success: true, count: blessings.length, blessings: blessings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Post a new blessing (text-only)
app.post('/api/blessings', async (req, res) => {
  try {
    const { guestName, message } = req.body;
    if (!guestName || !message) {
      return res.status(400).json({ success: false, message: 'Please provide both your name and a blessing message.' });
    }
    const db = await readBlessings();
    const newBlessing = {
      id: Date.now().toString(),
      guestName: guestName.trim(),
      message: message.trim(),
      uploadedAt: new Date().toISOString()
    };
    db.unshift(newBlessing);
    await writeBlessings(db);
    res.status(201).json({ success: true, blessing: newBlessing });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin Authentication PIN (default 1234)
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';

// Verify admin pin
app.post('/api/admin/verify', (req, res) => {
  const { pin } = req.body;
  if (pin === ADMIN_PIN) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Invalid Admin PIN.' });
  }
});

// Delete a single photo
app.delete('/api/photos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    
    // Auth Check
    if (authHeader !== `Bearer ${ADMIN_PIN}`) {
      return res.status(401).json({ success: false, message: 'Unauthorized action.' });
    }

    const db = await readDB();
    const photoToDelete = db.find(img => img.id === id);

    if (!photoToDelete) {
      return res.status(404).json({ success: false, message: 'Photo not found.' });
    }

    // Delete representation from cloud or disk fallbacks
    if (isR2Configured && r2Client) {
      const key = `photos/${photoToDelete.filename}`;
      try {
        await r2Client.send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
          })
        );
      } catch (r2Err) {
        console.error('Failed to clean item from R2 bucket:', r2Err);
      }
    } else {
      const filePath = path.join(UPLOADS_DIR, photoToDelete.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete record from database
    const updatedDb = db.filter(img => img.id !== id);
    await writeDB(updatedDb);

    res.json({ success: true, message: 'Photo deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete a single blessing
app.delete('/api/blessings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    
    if (authHeader !== `Bearer ${ADMIN_PIN}`) {
      return res.status(401).json({ success: false, message: 'Unauthorized action.' });
    }

    const db = await readBlessings();
    const blessingToDelete = db.find(b => b.id === id);

    if (!blessingToDelete) {
      return res.status(404).json({ success: false, message: 'Blessing not found.' });
    }

    const updatedDb = db.filter(b => b.id !== id);
    await writeBlessings(updatedDb);

    res.json({ success: true, message: 'Blessing deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Proxy endpoint to bypass CORS when downloading photos directly to user browser
app.get('/api/proxy-download', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).send('URL parameter is required.');
    }

    // Force absolute path for local files when proxying internally
    let target = imageUrl;
    if (imageUrl.startsWith('/')) {
      target = `http://localhost:${PORT}${imageUrl}`;
    }

    const remoteRes = await fetch(target);
    if (!remoteRes.ok) {
      throw new Error(`Failed to request image: ${remoteRes.statusText}`);
    }

    const contentType = remoteRes.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    
    if (req.query.view !== 'true') {
      const parsedUrl = new URL(target, `http://localhost:${PORT}`);
      const name = path.basename(parsedUrl.pathname) || 'download.jpg';
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    }

    const imageArrayBuffer = await remoteRes.arrayBuffer();
    res.send(Buffer.from(imageArrayBuffer));
  } catch (err) {
    console.error('CORS download proxy failed to execute:', err);
    res.status(500).send('Failed to proxy fetch target file.');
  }
});

// Stream all database photos in a single ZIP package to bypass browser down-limitations
app.get('/api/download-all-photos', async (req, res) => {
  const tempDir = path.join(os.tmpdir(), `temp_zip_${Date.now()}`);
  const zipPath = path.join(os.tmpdir(), `Nathan_Photos_${Date.now()}.zip`);
  try {
    let photosList = [];
    try {
      photosList = await readDB();
    } catch (e) {
      return res.status(404).send('No photos database found.');
    }

    if (photosList.length === 0) {
      return res.status(404).send('No photos available to download.');
    }

    // Create a temporary workspace folder
    fs.mkdirSync(tempDir, { recursive: true });

    // Download/Copy matching photos into directory
    for (let i = 0; i < photosList.length; i++) {
      const photo = photosList[i];
      const name = photo.filename || `nathan-photo-${photo.id}.jpg`;
      const targetPath = path.join(tempDir, name);

      if (photo.url.startsWith('/') || photo.url.startsWith('http://localhost') || !process.env.R2_BUCKET_NAME) {
        // Local file fallback
        const sourcePath = path.join(UPLOADS_DIR, photo.filename);
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, targetPath);
        }
      } else {
        // R2 hosted file
        try {
          const remoteResponse = await fetch(photo.url);
          if (remoteResponse.ok) {
            const arrayBuffer = await remoteResponse.arrayBuffer();
            fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));
          }
        } catch (fetchErr) {
          console.error(`Failed to copy remote file ${photo.url} for ZIP packaging:`, fetchErr);
        }
      }
    }

    const filesInTemp = fs.readdirSync(tempDir);
    if (filesInTemp.length === 0) {
      return res.status(404).send('No valid photos fetched to pack in archive.');
    }

    // Zip directory elements using archiver (pure JS zipping)
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(tempDir, false);

    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
      archive.finalize();
    });

    // Serve download zip using Express native helper
    res.download(zipPath, 'Nathan_Baptism_Photos.zip', (downloadError) => {
      try {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanError) {
        console.error('Error executing zip folder cleanups:', cleanError);
      }
      if (downloadError && !res.headersSent) {
        console.error('Error during zip download delivery:', downloadError);
      }
    });
  } catch (error) {
    console.error('Fatal crash composing photo zip payload:', error);
    res.status(500).send('Server failed to compile photos zip.');
    try {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    } catch (_) {}
  }
});

// Compile uploaded files into a zip download (useful for downloading Canvas-generated files without multiple single prompts)
app.post('/api/compile-zip', upload.array('files'), async (req, res) => {
  console.log('[COMPILE ZIP] Incoming request files layout:', req.files ? req.files.map(f => ({ name: f.originalname, size: f.size })) : 'null');
  const tempDir = path.join(os.tmpdir(), `temp_zip_${Date.now()}`);
  const zipPath = path.join(os.tmpdir(), `Nathan_Exports_${Date.now()}.zip`);
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      console.log('[COMPILE ZIP] No files received');
      return res.status(400).send('No files uploaded.');
    }

    fs.mkdirSync(tempDir, { recursive: true });

    // Move uploaded temp files to their target name inside workspace directory
    for (const file of files) {
      const targetName = file.originalname || `export-${Date.now()}.png`;
      const targetPath = path.join(tempDir, targetName);
      
      if (file.buffer) {
        // memoryStorage (when R2 is active)
        fs.writeFileSync(targetPath, file.buffer);
      } else if (file.path) {
        // diskStorage fallback
        fs.renameSync(file.path, targetPath);
      }
    }

    // Zip directory elements using archiver (pure JS zipping)
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(tempDir, false);

    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
      archive.finalize();
    });

    const outName = req.body.archiveName || 'Nathan_Export_Cards.zip';
    res.download(zipPath, outName, (downloadError) => {
      try {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanError) {
        console.error('Error cleaning compile zip temp elements:', cleanError);
      }
      if (downloadError && !res.headersSent) {
        console.error('Error during compiled zip download delivery:', downloadError);
      }
    });
  } catch (error) {
    console.error('Failed converting blobs to zip file container:', error);
    res.status(500).send('Failed creating dynamic zip file array.');
    try {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    } catch (_) {}
  }
});

// 3. Clear database endpoint (for resetting or cleaning up admin side)
app.delete('/api/photos', async (req, res) => {
  try {
    // Empty database.json
    await writeDB([]);
    // Empty blessings.json
    await writeBlessings([]);
    // Remove all files from uploads dir except any placeholder
    if (fs.existsSync(UPLOADS_DIR)) {
      const files = fs.readdirSync(UPLOADS_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(UPLOADS_DIR, file));
      }
    }
    res.json({ success: true, message: 'Database reset successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Serve frontend in production (after npm run build)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('API Server is running. To serve frontend, build the react app using `npm run build` first.');
  });
}

// Global error handler for upload issues
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

if (!isNetlify) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server started on http://localhost:${PORT}`);
    console.log(`Open on other local devices with: http://<your-local-ip>:${PORT}`);
  });
}

export { app };
