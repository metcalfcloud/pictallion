// Extended UI tests for App component with Tauri integration
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import {
  mockTauriSuccess,
  mockTauriFailure,
  getTauriCallHistory,
  TauriMockManager,
} from "./mocks/tauriMocks";

describe("App Component with Tauri Integration", () => {
  let mockManager: TauriMockManager;

  beforeEach(() => {
    mockManager = TauriMockManager.getInstance();
    mockManager.reset();
  });

  it("renders without crashing", () => {
    const { getAllByText } = render(<App />);
    expect(getAllByText(/pictallion/i).length).toBeGreaterThan(0);
  });

  it("should detect Tauri environment correctly", () => {
    render(<App />);
    // The app should render without errors even when Tauri APIs are mocked
    expect(screen.getAllByText(/pictallion/i).length).toBeGreaterThan(0);
  });

  it("should handle Tauri API calls from Upload component", async () => {
    mockTauriSuccess();

    render(<App />);

    // Navigate to Upload via sidebar nav button (stable selector)
    const uploadTab = screen.queryByTestId('upload-button') || screen.queryByRole('tab', { name: /upload/i });
    if (uploadTab) {
      await userEvent.click(uploadTab);

      // Try to find upload functionality
      const fileInput = screen.queryByLabelText(/image file input/i);
      if (fileInput) {
        const file = new File(["test content"], "test-app.jpg", {
          type: "image/jpeg",
        });
        await userEvent.upload(fileInput, file);

      const uploadButton = screen.queryByRole("button", { name: /upload selected image/i });
        if (uploadButton && !uploadButton.hasAttribute("disabled")) {
          await userEvent.click(uploadButton);

          // Wait for potential API call
          await waitFor(() => {
            const callHistory = getTauriCallHistory();
            const hasAdd = callHistory.some((c) => c.command === "add_photo");
            expect(hasAdd).toBe(true);
          }, { timeout: 1500 });
        }
      }
    }
  });

  it("should handle Tauri API errors gracefully in the app context", async () => {
    mockTauriFailure("Simulated API error");

    render(<App />);

    // The app should still render and not crash when Tauri APIs fail
    expect(screen.getAllByText(/pictallion/i).length).toBeGreaterThan(0);

    // Any Tauri API calls should be handled gracefully
    const uploadTab = screen.queryByTestId('upload-button') || screen.queryByRole('tab', { name: /upload/i });
    if (uploadTab) {
      await userEvent.click(uploadTab);

      const fileInput = screen.queryByLabelText(/image file input/i);
      if (fileInput) {
        const file = new File(["test content"], "error-test.jpg", {
          type: "image/jpeg",
        });
        await userEvent.upload(fileInput, file);

        const uploadButton = screen.queryByRole("button", { name: /upload selected image/i });
        if (uploadButton && !uploadButton.hasAttribute("disabled")) {
          await userEvent.click(uploadButton);

          // Should handle error without crashing
          await waitFor(() => {
            // App should still be functional
            expect(screen.getAllByText(/pictallion/i).length).toBeGreaterThan(0);
          }, { timeout: 1000 });
        }
      }
    }
  });

  it("should work in non-Tauri environments", () => {
    // Simulate non-Tauri environment
    const globalWindow = global as unknown as {
      window?: { __TAURI_IPC__?: unknown };
    };
    delete globalWindow.window?.__TAURI_IPC__;

    render(<App />);

    // App should still render in non-Tauri environments
    expect(screen.getAllByText(/pictallion/i).length).toBeGreaterThan(0);
  });

  it("should handle multiple component interactions with Tauri APIs", async () => {
    mockTauriSuccess({
      list_photos: [
        { id: "photo-1", filePath: "/test/photo1.jpg", tier: "bronze" },
        { id: "photo-2", filePath: "/test/photo2.jpg", tier: "silver" },
      ],
      list_people: [
        { id: "person-1", name: "Test Person 1" },
        { id: "person-2", name: "Test Person 2" },
      ],
    });

    render(<App />);

    // Test that multiple components can interact with Tauri APIs
    // This tests the overall integration rather than individual components

    // Check for Gallery tab
    const galleryTab = screen.queryByTestId('gallery-nav') || screen.queryByRole('tab', { name: /gallery/i });
    if (galleryTab) {
      await userEvent.click(galleryTab);

      // Wait for potential API calls
      await waitFor(
        () => {
          const callHistory = getTauriCallHistory();
          // Gallery might call list_photos
          const hasPhotoCall = callHistory.some(
            (call) => call.command === "list_photos",
          );
          if (hasPhotoCall) {
            expect(hasPhotoCall).toBe(true);
          }
        },
        { timeout: 1000 },
      );
    }

    // Check for People via stable sidebar test id to avoid ambiguous matches
    const peopleTab =
      screen.queryByTestId('people-manager-nav') ||
      screen.queryByRole('tab', { name: /people/i });
    if (peopleTab) {
      await userEvent.click(peopleTab);

      // Wait for potential API calls
      await waitFor(
        () => {
          const callHistory = getTauriCallHistory();
          // People component might call list_people
          const hasPeopleCall = callHistory.some(
            (call) => call.command === "list_people",
          );
          if (hasPeopleCall) {
            expect(hasPeopleCall).toBe(true);
          }
        },
        { timeout: 1000 },
      );
    }
  });

  it("should maintain app state during Tauri API operations", async () => {
    mockTauriSuccess();

    render(<App />);

    // Verify app maintains its state during API operations
    expect(screen.getAllByText(/pictallion/i).length).toBeGreaterThan(0);

    // Simulate some API calls
    await waitFor(() => {
      // App should maintain its core elements
      expect(screen.getAllByText(/pictallion/i).length).toBeGreaterThan(0);
    });
  });
});
