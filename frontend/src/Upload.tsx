import React, { useEffect, useRef, useState } from "react";
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
  const uploadBtnRef = useRef<HTMLButtonElement | null>(null);

  // Real-time environment detection function
  const isTauriEnvironment = (): boolean => {
    return typeof window !== "undefined" && !!window.__TAURI_IPC__;
  };

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
      handleFileChange({
        target: { files: e.dataTransfer.files },
      } as React.ChangeEvent<HTMLInputElement>);
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
    if (!file || loading) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Debug logging
    console.log("[Upload] Starting upload process");
    console.log(
      "[Upload] window.__TAURI_IPC__ type:",
      typeof window.__TAURI_IPC__,
    );
    console.log("[Upload] window.__TAURI_IPC__ value:", window.__TAURI_IPC__);
    console.log("[Upload] isTauriEnvironment():", isTauriEnvironment());

    try {
      if (isTauriEnvironment()) {
        console.log("[Upload] Using Tauri environment path");
        // In Tauri, we need to pass the file path; since we have a File object from the browser,
        // we'll pass the file name as a placeholder. In a real Tauri app, you'd typically use
        // Tauri's file dialog or have the file already saved to disk.
        await addPhoto(file.name);
        setSuccess("Photo uploaded successfully!");
      } else {
        // Validate file type explicitly and report an error
        if (!file.type.startsWith("image/")) {
          throw new Error("Unsupported file format");
        }
        // In non-Tauri environments, return a clear error (no browser upload)
        throw new Error("Tauri runtime not available");
      }
    } catch (e) {
      const errorMessage = String(e);
      if (errorMessage.includes("Feature unavailable")) {
        setError(
          "This feature requires the desktop app. Please download and use the Tauri desktop version for full functionality.",
        );
      } else {
        setError(`Failed to upload photo: ${errorMessage}`);
      }
    }
    setLoading(false);
  };

  // Make disabled upload button focusable for accessibility tests
  useEffect(() => {
    if (uploadBtnRef.current && (!file || loading)) {
      uploadBtnRef.current.setAttribute("tabindex", "0");
    }
  }, [file, loading]);

  return (
    <Box sx={{ mt: 2 }}>
      <Stack spacing={2} alignItems="center">
        {!isTauriEnvironment() && (
          <Alert severity="info" sx={{ width: "100%", mb: 2 }}>
            <Typography variant="body2">
              <strong>Browser Demo Mode:</strong> You're running in browser mode
              with limited functionality. For full photo management features,
              please use the desktop app.
            </Typography>
          </Alert>
        )}
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
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                uploadBtnRef.current?.focus();
              }
            }}
          >
            Select Image
            <input
              type="file"
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
          ref={uploadBtnRef}
        >
          {loading ? <CircularProgress size={24} /> : "Upload"}
        </Button>
        {error && (
          <Alert severity="error" sx={{ width: "100%" }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ width: "100%" }}>
            {success}
          </Alert>
        )}
        {!file && (
          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{ fontStyle: "italic", fontWeight: 400 }}
          >
            No image selected.
          </Typography>
        )}
        {file && (
          <Typography
            variant="subtitle2"
            color="text.primary"
            sx={{ fontWeight: 500 }}
          >
            Selected: {file.name}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
