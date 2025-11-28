import axios from 'axios';

const baseURL =
  import.meta.env.VITE_API_BASE_URL;

const httpClient = axios.create({
  baseURL,
  timeout: 15000,
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export default httpClient;
