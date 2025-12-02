const express = require('express');
const router = express.Router();

const multer = require('multer');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const {
  makeLogger,
} = require('../utils');

const log = makeLogger('api:pcap');

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}-${file.originalname}`);
    },
  }),
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
});

function safeUnlink(filePath) {
  if (!filePath) return;
  fs.unlink(filePath, (err) => {
    if (err) {
      log.warn('Failed to unlink temp file', { filePath, err: err.message || err });
    }
  });
}

/**
 * POST /pcap/pcap-http-requests
 *
 * Body: multipart/form-data
 *  - pcap:    .pcap / .pcapng file
 *  - sslkeys: TLS keylog file (e.g. sslkeys.log)
 *
 * Output: HttpRequest[] in JSON (already compatible with /http-requests/ingest-http schema)
 */
router.post(
  '/pcap-http-requests',
  upload.fields([
    { name: 'pcap', maxCount: 1 },
    { name: 'sslkeys', maxCount: 1 },
  ]),
  async (req, res) => {
    /** @type {string | undefined} */
    let pcapPath;
    /** @type {string | undefined} */
    let sslKeysPath;

    try {
      const files = /** @type {Record<string, Express.Multer.File[]>} */(req.files || {});

      const pcapFile = files.pcap && files.pcap[0];
      const sslKeysFile = files.sslkeys && files.sslkeys[0];

      if (!pcapFile) {
        return res.status(400).json({ error: 'Missing PCAP file field "pcap"' });
      }
      if (!sslKeysFile) {
        safeUnlink(pcapFile.path);
        return res.status(400).json({ error: 'Missing SSL keys file field "sslkeys"' });
      }

      pcapPath = pcapFile.path;
      sslKeysPath = sslKeysFile.path;

      log.info('Received PCAP + SSL keys', {
        pcapPath,
        sslKeysPath,
        pcapSize: pcapFile.size,
        sslKeysSize: sslKeysFile.size,
      });

      const scriptPath = path.join(__dirname, '../scripts', 'pcap_to_http_json.py');

      const pythonBin = process.env.PYTHON_BIN || 'python';

      const py = spawn(pythonBin, [scriptPath, pcapPath, sslKeysPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      py.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      py.stderr.on('data', (chunk) => {
        const s = chunk.toString();
        stderr += s;
      });

      const httpRequests = await new Promise((resolve, reject) => {
        py.on('error', (err) => reject(err));
        py.on('close', (code) => {
          if (code !== 0) {
            return reject(
              new Error(
                `Python script exited with code ${code}. stderr: ${stderr || 'n/a'}`
              )
            );
          }

          try {
            const parsed = JSON.parse(stdout || '[]');
            resolve(parsed);
          } catch (err) {
            reject(
              new Error(
                `Failed to parse JSON from python stdout: ${(err && err.message) || err}`
              )
            );
          }
        });
      });

      if (!Array.isArray(httpRequests)) {
        log.warn('Python script did not return an array', { type: typeof httpRequests });
      }

      return res.status(200).json(httpRequests);
    } catch (err) {
      log.error('pcap-http-requests failed', err?.message || err);
      return res.status(500).json({
        error: 'PCAP processing failed',
        detail: String(err?.message || err),
      });
    } finally {
      safeUnlink(pcapPath);
      safeUnlink(sslKeysPath);
    }
  }
);

module.exports = router;
