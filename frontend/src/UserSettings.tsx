import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";

export function UserSettings() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSave = () => {
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  return (
    <Box data-testid="user-profile">
      <Paper elevation={3} sx={{ p: 4, maxWidth: 480, mx: "auto" }}>
        <Typography variant="h4" gutterBottom>
          User Profile & Settings
        </Typography>
        <Stack spacing={3}>
          <TextField
            label="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            fullWidth
          />
          <TextField
            label="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            fullWidth
          />
          <Button variant="contained" color="primary" onClick={handleSave}>
            Save Changes
          </Button>
          {success && (
            <Typography variant="body2" color="success.main">
              Profile updated!
            </Typography>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}