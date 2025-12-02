import httpClient from "./httpClient";

/**
 * POST /pcap/pcap-http-requests
 */
export async function extractHttpRequestsFromPcap(pcapFile, sslKeysFile) {
  const formData = new FormData();
  formData.append("pcap", pcapFile);
  formData.append("sslkeys", sslKeysFile);

  const res = await httpClient.post("/pcap/pcap-http-requests", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data;
}
