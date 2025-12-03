/**
 * PCAP Service
 *
 * Uploads PCAP (and optional SSL key log) files to the backend for HTTP
 * extraction. Uses multipart/form-data to stream binary payloads.
 *
 * Endpoint Summary:
 * - POST /pcap/pcap-http-requests: extracts HTTP requests from a PCAP.
 *
 * Notes:
 * - Caller is responsible for validating file types and sizes.
 */

import httpClient from './httpClient';

/**
 * Extract HTTP requests from a PCAP file.
 * POST /pcap/pcap-http-requests
 *
 * @param {File|Blob} pcapFile    - The .pcap/.pcapng capture to process.
 * @param {File|Blob} [sslKeysFile] - NSS/Chromium SSL key log file.
 * @returns {Promise<any>} Parsed extraction result as returned by the backend.
 */
export async function extractHttpRequestsFromPcap(pcapFile, sslKeysFile) {
  const formData = new FormData();
  formData.append('pcap', pcapFile);
  formData.append('sslkeys', sslKeysFile);

  const res = await httpClient.post('/pcap/pcap-http-requests', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return res.data;
}
