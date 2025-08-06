import React, { useState } from "react";
import { addPhoto } from "./lib/tauriApi";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";

export function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setSuccess(null);
    setError(null);
    if (selected) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(selected);
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange({ target: { files: e.dataTransfer.files } } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await addPhoto(file.name);
      setSuccess("Photo uploaded successfully!");
    } catch (e) {
      setError(`Failed to upload photo: ${String(e)}`);
    }
    setLoading(false);
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Stack spacing={2} alignItems="center">
        <Box
          sx={{
            border: dragActive ? "2px dashed #535bf2" : "2px dashed #ccc",
            borderRadius: 2,
            p: 3,
            width: 320,
            textAlign: "center",
            bgcolor: dragActive ? "#f5f6fa" : "background.paper",
            transition: "border-color 0.2s, background 0.2s",
            cursor: "pointer",
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          tabIndex={0}
          aria-label="Drag and drop image upload area"
        >
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Drag & drop an image here, or
          </Typography>
          <Button
            variant="contained"
            component="label"
            disabled={loading}
            aria-label="Select image to upload"
            sx={{ minWidth: 140 }}
            tabIndex={0}
            data-testid="upload-button"
            style={{ display: "inline-block" }}
          >
            Select Image
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={handleFileChange}
              aria-label="Image file input"
              tabIndex={0}
            />
          </Button>
          {preview && (
            <Box sx={{ mt: 2 }} data-testid="upload-preview">
              <img
                src={preview}
                alt="Preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: 180,
                  borderRadius: 8,
                  border: "1px solid #e0e0e0",
                  boxShadow: "0 2px 8px rgba(60,60,120,0.10)",
                }}
              />
            </Box>
          )}
        </Box>
        <Button
          variant="contained"
          color="primary"
          onClick={handleUpload}
          disabled={!file || loading}
          aria-label="Upload selected image"
          sx={{ minWidth: 140 }}
          tabIndex={0}
        >
          {loading ? <CircularProgress size={24} /> : "Upload"}
        </Button>
        {error && <Alert severity="error" sx={{ width: "100%" }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ width: "100%" }}>{success}</Alert>}
        {!file && (
          <Typography variant="subtitle2" color="text.secondary" sx={{ fontStyle: "italic", fontWeight: 400 }}>
            No image selected.
          </Typography>
        )}
        {file && (
          <Typography variant="subtitle2" color="text.primary" sx={{ fontWeight: 500 }}>
            Selected: {file.name}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}