import { IconButton, Tooltip } from '@mui/material';
import { useCallback } from 'react';
import { enqueueSnackbar } from 'notistack';
import DownloadIcon from '@mui/icons-material/Download';

/**
 * **DownloadJsonButton**
 *
 * Small utility button that triggers download of a JSON file containing the
 * provided data. Frequently used for exporting scan results, payloads,
 * intercepted requests, etc.
 *
 * Technical Notes:
 * - Converts the input `data` to JSON string with indentation.
 * - Generates a temporary Blob URL for download.
 * - Cleans up the Object URL after the click.
 * - Uses notistack for success/error notifications.
 *
 * @param {Object} props
 * @param {any} props.data - Data to serialize to JSON.
 * @param {string} [props.filename="data.json"] - Output file name.
 * @param {boolean} [props.disabled=false] - Disable button manually.
 */
function DownloadJsonButton({ data, filename = 'data.json', disabled = false }) {
  /**
   * Initiates JSON file download.
   */
  const handleDownload = useCallback(() => {
    if (!data) return;

    try {
      const jsonString = JSON.stringify(data, null, 2);

      const blob = new Blob([jsonString], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;

      // Required for triggering the download programmatically
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      enqueueSnackbar('JSON file downloaded successfully.', {
        variant: 'success',
      });
    } catch (err) {
      console.error('Error while downloading JSON:', err);
      enqueueSnackbar('Error while downloading JSON.', {
        variant: 'error',
      });
    }
  }, [data, filename]);

  return (
    <Tooltip title="Download JSON">
      <IconButton variant="outlined" onClick={handleDownload} disabled={disabled || !data}>
        <DownloadIcon />
      </IconButton>
    </Tooltip>
  );
}

export default DownloadJsonButton;
