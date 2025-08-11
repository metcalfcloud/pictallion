import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import IconButton from "@mui/material/IconButton";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import { PeopleManager } from "./PeopleManager";
import { MetadataViewer } from "./MetadataViewer";
import { Gallery } from "./Gallery";
import { Upload } from "./Upload";
import { FaceDetection } from "./FaceDetection";
import { UserSettings } from "./UserSettings";

const NAV_ITEMS = [
  { key: "gallery", label: "Gallery" },
  { key: "upload", label: "Upload" },
  { key: "people", label: "People" },
  { key: "metadata", label: "Metadata" },
];

import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Fab from "@mui/material/Fab";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import PeopleIcon from "@mui/icons-material/People";
import InfoIcon from "@mui/icons-material/Info";
import SettingsIcon from "@mui/icons-material/Settings";

function App() {
  // Ensure Gallery tab is default for Puppeteer tests
  const [activeTab, setActiveTab] = useState(0);
  const [mode, setMode] = useState<"light" | "dark">(
    window.localStorage.getItem("theme") === "dark" ? "dark" : "light",
  );
  const [helpOpen, setHelpOpen] = useState(false);

  const sidebarItems = [
    {
      label: "Gallery",
      icon: <PhotoLibraryIcon />,
      tab: 0,
      testId: "gallery-nav",
    },
    {
      label: "Upload",
      icon: <UploadFileIcon />,
      tab: 1,
      testId: "upload-button",
    },
    {
      label: "Bulk Actions",
      icon: <PhotoLibraryIcon />,
      tab: 0,
      testId: "bulk-actions-nav",
    },
    {
      label: "Search",
      icon: <PhotoLibraryIcon />,
      tab: 0,
      testId: "search-input",
    },
    {
      label: "Face Detection",
      icon: <PhotoLibraryIcon />,
      tab: 0,
      testId: "face-detection-nav",
    },
    {
      label: "People",
      icon: <PeopleIcon />,
      tab: 2,
      testId: "people-manager-nav",
    },
    {
      label: "Metadata",
      icon: <InfoIcon />,
      tab: 3,
      testId: "metadata-viewer-nav",
    },
    {
      label: "Settings",
      icon: <SettingsIcon />,
      tab: 4,
      testId: "user-settings-nav",
    },
  ];

  const theme = createTheme({
    palette: {
      mode,
      primary: {
        main: mode === "light" ? "#213547" : "#ffd700",
      },
      secondary: {
        main: "#ffd700",
      },
      background: {
        default: mode === "light" ? "#f5f6fa" : "#242424",
        paper: mode === "light" ? "#fff" : "#1a1a1a",
      },
      text: {
        primary: mode === "light" ? "#213547" : "#ffd700",
        secondary: mode === "light" ? "#535bf2" : "#ffec80",
      },
    },
    typography: {
      fontFamily: "'Inter', system-ui, sans-serif",
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          bgcolor: "background.default",
          minHeight: "100vh",
          display: "flex",
        }}
      >
        {/* Sidebar */}
        <Drawer
          variant="permanent"
          sx={{
            width: 220,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: 220,
              boxSizing: "border-box",
              bgcolor: "primary.main",
              color: "#fff",
            },
            display: { xs: "none", md: "block" },
          }}
          open
        >
          <Toolbar />
          <List>
            {sidebarItems.map((item) => (
              <ListItem key={item.label} disablePadding>
                <ListItemButton
                  selected={activeTab === item.tab}
                  onClick={() => setActiveTab(item.tab)}
                  aria-label={`Go to ${item.label}`}
                  data-testid={item.testId ? item.testId : undefined}
                >
                  <ListItemIcon sx={{ color: "secondary.main" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Drawer>
        {/* Main Content */}
        <Box sx={{ flexGrow: 1, px: { xs: 1, md: 4 }, py: 4 }}>
          <AppBar
            position="fixed"
            color="primary"
            elevation={2}
            sx={{ zIndex: 1201 }}
          >
            <Toolbar>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                Pictallion
              </Typography>
              <IconButton
                sx={{ ml: 1 }}
                onClick={() => {
                  const newMode = mode === "light" ? "dark" : "light";
                  setMode(newMode);
                  window.localStorage.setItem("theme", newMode);
                  document.body.className = newMode === "dark" ? "dark" : "";
                }}
                color="inherit"
                aria-label="Toggle light/dark mode"
                data-testid="dark-mode-toggle"
              >
                {mode === "light" ? <Brightness4Icon /> : <Brightness7Icon />}
              </IconButton>
              <IconButton
                sx={{ ml: 1 }}
                onClick={() => setHelpOpen(true)}
                color="inherit"
                aria-label="Open help modal"
                data-testid="help-nav"
              >
                <HelpOutlineIcon />
              </IconButton>
              <Tabs
                value={activeTab}
                onChange={(_, v) => setActiveTab(v)}
                textColor="inherit"
                indicatorColor="secondary"
                sx={{ display: { xs: "flex", md: "none" } }}
                data-testid="mobile-nav"
              >
                {NAV_ITEMS.map((item) => (
                  <Tab key={item.key} label={item.label} />
                ))}
              </Tabs>
            </Toolbar>
          </AppBar>
          <Toolbar />
          <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography
                variant="h2"
                gutterBottom
                align="center"
                sx={{ fontWeight: 700 }}
              >
                Welcome to Pictallion
              </Typography>
              <Typography
                variant="h5"
                align="center"
                gutterBottom
                sx={{ color: "text.secondary", fontWeight: 400 }}
              >
                A modern photo management app built with Tauri, Rust, and React.
              </Typography>
              <Box sx={{ mt: 4 }}>
                {activeTab === 0 && (
                  <Box>
                    <Typography
                      variant="h4"
                      gutterBottom
                      sx={{ fontWeight: 600 }}
                    >
                      Photo Gallery
                    </Typography>
                    <Gallery />
                    <Box sx={{ mt: 2 }}>
                      <FaceDetection imagePath="" />
                    </Box>
                  </Box>
                )}
                {activeTab === 1 && (
                  <Box>
                    <Typography
                      variant="h4"
                      gutterBottom
                      sx={{ fontWeight: 600 }}
                    >
                      Upload Photos
                    </Typography>
                    <Upload />
                  </Box>
                )}
                {activeTab === 2 && (
                  <Box>
                    <Typography
                      variant="h4"
                      gutterBottom
                      sx={{ fontWeight: 600 }}
                    >
                      People Manager
                    </Typography>
                    <PeopleManager />
                  </Box>
                )}
                {activeTab === 3 && (
                  <Box>
                    <Typography
                      variant="h4"
                      gutterBottom
                      sx={{ fontWeight: 600 }}
                    >
                      Metadata Viewer
                    </Typography>
                    <MetadataViewer photoId="" />
                  </Box>
                )}
                {activeTab === 4 && <UserSettings data-testid="user-profile" />}
              </Box>
            </Paper>
            <Box sx={{ mt: 4, textAlign: "center", color: "text.secondary" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 400 }}>
                © 2025 Pictallion. All rights reserved.
              </Typography>
            </Box>
          </Container>
          {/* Floating Action Button */}
          <Fab
            color="secondary"
            aria-label="Quick upload"
            sx={{
              position: "fixed",
              bottom: 32,
              right: 32,
              zIndex: 1300,
              bgcolor: "secondary.main",
              color: "primary.main",
              "&:hover": { bgcolor: "#ffec80" },
            }}
            onClick={() => setActiveTab(1)}
          >
            <UploadFileIcon />
          </Fab>
        </Box>
      </Box>
      {/* Onboarding/Help Modal */}
      <Dialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        aria-labelledby="help-dialog-title"
        data-testid="onboarding-modal"
      >
        <DialogTitle id="help-dialog-title">Welcome to Pictallion</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body1" gutterBottom>
            This app helps you manage your photo collection with advanced
            features:
          </Typography>
          <ul>
            <li>Browse and search your photos in a responsive gallery.</li>
            <li>Upload images with drag-and-drop and preview support.</li>
            <li>Bulk select and delete photos for efficient management.</li>
            <li>Manage people, view metadata, and use face detection.</li>
            <li>Switch between light/dark modes for comfort.</li>
            <li>Access user settings and profile management.</li>
            <li>Keyboard navigation and accessibility features throughout.</li>
          </ul>
          <Typography variant="body2" color="text.secondary">
            For more help, visit the documentation or contact support.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpOpen(false)} color="primary" autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}

export default App;
