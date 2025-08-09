// Integration tests for upload functionality with Tauri API mocking
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Upload } from '../../src/Upload';
import {
  mockTauriSuccess,
  mockTauriFailure,
  mockTauriDelay,
  getTauriCallHistory,
  TauriMockManager
} from '../mocks/tauriMocks';

describe('Upload Integration Tests', () => {
  let mockManager: TauriMockManager;

  beforeEach(() => {
    mockManager = TauriMockManager.getInstance();
    mockManager.reset();
  });

  describe('Successful Upload Flow', () => {
    it('should successfully upload a photo through Tauri API', async () => {
      mockTauriSuccess();
      
      render(<Upload />);
      
      // Create a mock file
      const file = new File(['test content'], 'test-photo.jpg', { type: 'image/jpeg' });
      
      // Find the file input and upload the file
      const fileInput = screen.getByLabelText(/image file input/i);
      await userEvent.upload(fileInput, file);
      
      // Verify file is selected
      expect(screen.getByText('Selected: test-photo.jpg')).toBeInTheDocument();
      
      // Click upload button
      const uploadButton = screen.getByRole('button', { name: /upload selected image/i });
      await userEvent.click(uploadButton);
      
      // Wait for success message
      await waitFor(() => {
        expect(screen.getByText('Photo uploaded successfully!')).toBeInTheDocument();
      });
      
      // Verify Tauri API was called correctly
      const callHistory = getTauriCallHistory();
      expect(callHistory).toHaveLength(1);
      expect(callHistory[0].command).toBe('add_photo');
      expect(callHistory[0].args).toEqual({ filePath: 'test-photo.jpg' });
    });

    it('should handle drag and drop upload', async () => {
      mockTauriSuccess();
      
      render(<Upload />);
      
      const file = new File(['test content'], 'dropped-photo.jpg', { type: 'image/jpeg' });
      const dropZone = screen.getByLabelText(/drag and drop image upload area/i);
      
      // Simulate drag and drop
      fireEvent.dragOver(dropZone);
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file]
        }
      });
      
      // Verify file is selected
      await waitFor(() => {
        expect(screen.getByText('Selected: dropped-photo.jpg')).toBeInTheDocument();
      });
      
      // Upload the file
      const uploadButton = screen.getByRole('button', { name: /upload selected image/i });
      await userEvent.click(uploadButton);
      
      // Wait for success
      await waitFor(() => {
        expect(screen.getByText('Photo uploaded successfully!')).toBeInTheDocument();
      });
      
      // Verify API call
      const callHistory = getTauriCallHistory();
      expect(callHistory[0].command).toBe('add_photo');
      expect(callHistory[0].args).toEqual({ filePath: 'dropped-photo.jpg' });
    });

    it('should show loading state during upload', async () => {
      // Add delay to simulate slow upload
      mockTauriDelay(100);
      mockTauriSuccess();
      
      render(<Upload />);
      
      const file = new File(['test content'], 'slow-upload.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByLabelText(/image file input/i);
      await userEvent.upload(fileInput, file);
      
      const uploadButton = screen.getByRole('button', { name: /upload selected image/i });
      await userEvent.click(uploadButton);
      
      // Should show loading spinner
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      
      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText('Photo uploaded successfully!')).toBeInTheDocument();
      }, { timeout: 200 });
      
      // Loading spinner should be gone
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle Tauri API errors gracefully', async () => {
      mockTauriFailure('Network connection failed');
      
      render(<Upload />);
      
      const file = new File(['test content'], 'error-photo.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByLabelText(/image file input/i);
      await userEvent.upload(fileInput, file);
      
      const uploadButton = screen.getByRole('button', { name: /upload selected image/i });
      await userEvent.click(uploadButton);
      
      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/failed to upload photo.*network connection failed/i)).toBeInTheDocument();
      });
      
      // Verify API was still called
      const callHistory = getTauriCallHistory();
      expect(callHistory).toHaveLength(1);
      expect(callHistory[0].command).toBe('add_photo');
    });

    it('should handle file system permission errors', async () => {
      mockTauriFailure('Permission denied: Cannot access file system');
      
      render(<Upload />);
      
      const file = new File(['test content'], 'permission-error.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByLabelText(/image file input/i);
      await userEvent.upload(fileInput, file);
      
      const uploadButton = screen.getByRole('button', { name: /upload selected image/i });
      await userEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to upload photo.*permission denied/i)).toBeInTheDocument();
      });
    });

    it('should handle invalid file format errors', async () => {
      mockTauriFailure('Unsupported file format');
      
      render(<Upload />);
      
      const file = new File(['test content'], 'invalid-file.txt', { type: 'text/plain' });
      const fileInput = screen.getByLabelText(/image file input/i);
      await userEvent.upload(fileInput, file);
      
      const uploadButton = screen.getByRole('button', { name: /upload selected image/i });
      await userEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to upload photo.*unsupported file format/i)).toBeInTheDocument();
      });
    });

    it('should handle Tauri runtime not available', async () => {
      // Simulate Tauri not being available
      const globalWindow = global as unknown as { window?: { __TAURI_IPC__?: unknown } };
      delete globalWindow.window?.__TAURI_IPC__;
      
      mockTauriFailure('Tauri runtime not available');
      
      render(<Upload />);
      
      const file = new File(['test content'], 'no-tauri.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByLabelText(/image file input/i);
      await userEvent.upload(fileInput, file);
      
      const uploadButton = screen.getByRole('button', { name: /upload selected image/i });
      await userEvent.click(uploadButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to upload photo.*tauri runtime not available/i)).toBeInTheDocument();
      });
    });
  });

  describe('UI State Management', () => {
    it('should disable upload button when no file is selected', () => {
      render(<Upload />);
      
      const uploadButton = screen.getByRole('button', { name: /upload selected image/i });
      expect(uploadButton).toBeDisabled();
    });

    it('should enable upload button when file is selected', async () => {
      render(<Upload />);
      
      const file = new File(['test content'], 'enable-test.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByLabelText(/image file input/i);
      await userEvent.upload(fileInput, file);
      
      const uploadButton = screen.getByRole('button', { name: /upload selected image/i });
      expect(uploadButton).not.toBeDisabled();
    });

    it('should disable upload button during upload', async () => {
      mockTauriDelay(100);
      mockTauriSuccess();
      
      render(<Upload />);
      
      const file = new File(['test content'], 'disable-test.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByLabelText(/image file input/i);
      await userEvent.upload(fileInput, file);
      
      const uploadButton = screen.getByRole('button', { name: /upload selected image/i });
      await userEvent.click(uploadButton);
      
      // Button should be disabled during upload
      expect(uploadButton).toBeDisabled();
      
      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText('Photo uploaded successfully!')).toBeInTheDocument();
      }, { timeout: 200 });
      
      // Button should be enabled again
      expect(uploadButton).not.toBeDisabled();
    });

    it('should show preview image when file is selected', async () => {
      render(<Upload />);
      
      const file = new File(['test content'], 'preview-test.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByLabelText(/image file input/i);
      await userEvent.upload(fileInput, file);
      
      // Should show preview container
      await waitFor(() => {
        expect(screen.getByTestId('upload-preview')).toBeInTheDocument();
      });
      
      // Should show preview image
      const previewImage = screen.getByAltText('Preview');
      expect(previewImage).toBeInTheDocument();
    });

    it('should clear error messages when new file is selected', async () => {
      mockTauriFailure('Test error');
      
      render(<Upload />);
      
      // Upload first file that will fail
      const file1 = new File(['test content'], 'error-file.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByLabelText(/image file input/i);
      await userEvent.upload(fileInput, file1);
      
      const uploadButton = screen.getByRole('button', { name: /upload selected image/i });
      await userEvent.click(uploadButton);
      
      // Wait for error
      await waitFor(() => {
        expect(screen.getByText(/failed to upload photo.*test error/i)).toBeInTheDocument();
      });
      
      // Select new file
      const file2 = new File(['test content'], 'new-file.jpg', { type: 'image/jpeg' });
      await userEvent.upload(fileInput, file2);
      
      // Error message should be cleared
      expect(screen.queryByText(/failed to upload photo/i)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<Upload />);
      
      expect(screen.getByLabelText(/drag and drop image upload area/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/select image to upload/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/upload selected image/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/image file input/i)).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      render(<Upload />);
      
      const selectButton = screen.getByLabelText(/select image to upload/i);
      const uploadButton = screen.getByLabelText(/upload selected image/i);
      
      // Should be able to tab to buttons
      selectButton.focus();
      expect(document.activeElement).toBe(selectButton);
      
      // Tab to upload button
      await userEvent.tab();
      expect(document.activeElement).toBe(uploadButton);
    });
  });
});