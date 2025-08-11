// People management UI for Pictallion Tauri app.
// Uses strict TypeScript and IPC helper for backend integration.
// Comments explain "why" logic exists for maintainability.

import { useState, useEffect } from "react";
import {
  listPeople,
  createPerson,
  updatePerson,
  deletePerson,
  mergePeople,
  listRelationships,
} from "./lib/tauriApi";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import Checkbox from "@mui/material/Checkbox";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";

export function PeopleManager() {
  const [people, setPeople] = useState<Array<{ id: string; name: string }>>([]);
  const [newName, setNewName] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [mergeIds, setMergeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPeople() {
      try {
        const result = await listPeople();
        setPeople(result);
      } catch (e) {
        setError(`Failed to load people: ${String(e)}`);
      }
    }
    fetchPeople();
  }, []);

  const handleCreate = async () => {
    try {
      await createPerson({ name: newName });
      setNewName("");
      const result = await listPeople();
      setPeople(result);
    } catch (e) {
      setError(`Failed to create person: ${String(e)}`);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await updatePerson(id, { name: newName });
      setNewName("");
      const result = await listPeople();
      setPeople(result);
      setSelectedPerson(null);
    } catch (e) {
      setError(`Failed to update person: ${String(e)}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePerson(id);
      const result = await listPeople();
      setPeople(result);
    } catch (e) {
      setError(`Failed to delete person: ${String(e)}`);
    }
  };

  const handleMerge = async () => {
    try {
      await mergePeople({ personIds: mergeIds });
      setMergeIds([]);
      const result = await listPeople();
      setPeople(result);
    } catch (e) {
      setError(`Failed to merge people: ${String(e)}`);
    }
  };

  const handleListRelationships = async (id: string) => {
    try {
      const rels = await listRelationships(id);
      alert(JSON.stringify(rels, null, 2));
    } catch (e) {
      setError(`Failed to fetch relationships: ${String(e)}`);
    }
  };

  return (
    <Box sx={{ mt: 2 }} data-testid="people-manager-nav">
      <Typography variant="h6" gutterBottom>
        People Management
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <TextField
          label="Person name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          size="small"
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleCreate}
          disabled={!newName}
        >
          Add
        </Button>
      </Stack>
      <Divider sx={{ mb: 2 }} />
      <Typography variant="subtitle1" gutterBottom>
        People List
      </Typography>
      <List data-testid="people-list">
        {people.length === 0 ? (
          <ListItem data-testid="person-item">
            <ListItemText primary="No people found." />
          </ListItem>
        ) : (
          people.map((person) => (
            <ListItem
              key={person.id}
              data-testid="person-item"
              secondaryAction={
                <Stack direction="row" spacing={1}>
                  <IconButton
                    edge="end"
                    aria-label={`Edit ${person.name}`}
                    onClick={() => {
                      setSelectedPerson(person.id);
                      setNewName(person.name);
                    }}
                    tabIndex={0}
                  >
                    Edit
                  </IconButton>
                  <IconButton
                    edge="end"
                    aria-label={`Delete ${person.name}`}
                    onClick={() => handleDelete(person.id)}
                    tabIndex={0}
                  >
                    Delete
                  </IconButton>
                  <IconButton
                    edge="end"
                    aria-label={`Show relationships for ${person.name}`}
                    onClick={() => handleListRelationships(person.id)}
                    tabIndex={0}
                  >
                    Rel
                  </IconButton>
                  <Checkbox
                    checked={mergeIds.includes(person.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setMergeIds([...mergeIds, person.id]);
                      } else {
                        setMergeIds(mergeIds.filter((id) => id !== person.id));
                      }
                    }}
                    inputProps={{
                      "aria-label": `Select ${person.name} for merge`,
                    }}
                    tabIndex={0}
                  />
                </Stack>
              }
            >
              <ListItemText primary={person.name} />
            </ListItem>
          ))
        )}
      </List>
      <Button
        variant="contained"
        color="secondary"
        onClick={handleMerge}
        disabled={mergeIds.length < 2}
        sx={{ mt: 2 }}
      >
        Merge Selected
      </Button>
      {selectedPerson && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Edit Person
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              label="New name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              size="small"
            />
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleUpdate(selectedPerson)}
              disabled={!newName}
            >
              Update
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => setSelectedPerson(null)}
            >
              Cancel
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  );
}
