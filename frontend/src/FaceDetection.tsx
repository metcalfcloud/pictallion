// Face detection UI for Pictallion Tauri app.
// Uses strict TypeScript and IPC helper for backend integration.
// Comments explain "why" logic exists for maintainability.

import { useState } from "react";
import { detectFaces } from "./lib/tauriApi";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";

interface FaceDetectionProps {
  imagePath: string;
}

export function FaceDetection({ imagePath }: FaceDetectionProps) {
  const [faces, setFaces] = useState<
    Array<{ boundingBox: [number, number, number, number] }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDetectFaces = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await detectFaces(imagePath);
      setFaces(result);
    } catch (e) {
      setError(`Failed to detect faces: ${String(e)}`);
    }
    setLoading(false);
  };

  return (
    <Box sx={{ mt: 2 }} data-testid="face-detection-nav">
      <Button
        variant="contained"
        color="primary"
        onClick={handleDetectFaces}
        disabled={loading}
        aria-label="Detect faces in photo"
        sx={{ minWidth: 140 }}
      >
        {loading ? <CircularProgress size={20} /> : "Detect Faces"}
      </Button>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      <Paper sx={{ mt: 2, p: 2, bgcolor: "#f9f9f9" }} data-testid="face-detection-result">
        {faces.length === 0 && !error ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic", mt: 2 }}>
            No faces detected.
          </Typography>
        ) : (
          <>
            <Typography variant="subtitle2" gutterBottom>
              Detected Faces
            </Typography>
            <List>
              {faces.map((face, idx) => (
                <ListItem key={idx} sx={{ borderBottom: "1px solid #eee" }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Bounding Box: {face.boundingBox.join(", ")}
                  </Typography>
                </ListItem>
              ))}
            </List>
          </>
        )}
      </Paper>
    </Box>
  );
}