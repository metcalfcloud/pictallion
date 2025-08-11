// Metadata viewing UI for Pictallion Tauri app.
// Uses strict TypeScript and IPC helper for backend integration.
// Comments explain "why" logic exists for maintainability.

import { useState } from "react";
import { getPhotoMetadata } from "./lib/tauriApi";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";

interface MetadataViewerProps {
  photoId: string;
}

export function MetadataViewer({ photoId }: MetadataViewerProps) {
  const [metadata, setMetadata] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFetchMetadata = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPhotoMetadata(photoId);
      setMetadata(result);
    } catch (e) {
      setError(`Failed to fetch metadata: ${String(e)}`);
    }
    setLoading(false);
  };

  return (
    <Box sx={{ mt: 2 }} data-testid="metadata-viewer-nav">
      <Button
        variant="contained"
        color="primary"
        onClick={handleFetchMetadata}
        disabled={loading}
        aria-label="View photo metadata"
        sx={{ minWidth: 140 }}
      >
        {loading ? <CircularProgress size={20} /> : "View Metadata"}
      </Button>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      <Paper
        sx={{ mt: 2, p: 2, bgcolor: "#f9f9f9" }}
        data-testid="metadata-table"
      >
        {!metadata && !error ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontStyle: "italic", mt: 2 }}
          >
            No metadata loaded.
          </Typography>
        ) : (
          <>
            <Typography variant="subtitle2" gutterBottom>
              Metadata
            </Typography>
            <pre style={{ fontSize: "0.95em", margin: 0 }}>{metadata}</pre>
          </>
        )}
      </Paper>
    </Box>
  );
}
