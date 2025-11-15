import { IconButton, Tooltip } from "@mui/material";
import { useCallback } from "react";
import { enqueueSnackbar } from "notistack";
import DownloadIcon from '@mui/icons-material/Download';

function DownloadJsonButton({ data, filename = "data.json", disabled = false }) {
  const handleDownload = useCallback(() => {
    if (!data) return;

    try {
      const jsonString = JSON.stringify(data, null, 2);

      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      enqueueSnackbar("JSON file downloaded successfully.", { variant: "success" });
    } catch (err) {
      console.error("Error while downloading JSON:", err);
      enqueueSnackbar("Error while downloading JSON.", { variant: "error" });
    }
  }, [data, filename]);

  return (
    <Tooltip title={"Download JSON"} >
      <IconButton
        variant="outlined"
        onClick={handleDownload}
        disabled={disabled || !data}
      >
        <DownloadIcon />
      </IconButton>
    </Tooltip>
  );
}

export default DownloadJsonButton;
