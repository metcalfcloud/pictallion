import { useEffect, useMemo, useRef, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";

import {
  assignFacePerson,
  listFaces,
  listPeople,
  createPerson,
  type FaceRow,
  listTags,
  listPhotoTags,
  createTag,
  assignTag,
  removeTag,
  listAlbums,
  createAlbum,
  addPhotoToAlbum,
  removePhotoFromAlbum,
} from "./lib/tauriApi";
import { detectFacesOnPath } from "./lib/faceDetection";
import { saveFaceDetections, toViewSrc } from "./lib/tauriApi";

export type PhotoItem = { id: string; filePath: string; tier: string };

type Props = {
  open: boolean;
  photo: PhotoItem | null;
  onClose: () => void;
  onFacesUpdated?: () => void;
};

export function PhotoDetail({ open, photo, onClose, onFacesUpdated }: Props) {
  const [faces, setFaces] = useState<FaceRow[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [imgUrl, setImgUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number }>({
    w: 1,
    h: 1,
  });
  const [newPersonName, setNewPersonName] = useState("");
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [photoTags, setPhotoTags] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [newTagName, setNewTagName] = useState("");
  const [albums, setAlbums] = useState<{ id: string; name: string }[]>([]);
  const [newAlbumName, setNewAlbumName] = useState("");

  useEffect(() => {
    async function init() {
      if (!photo) return;
      setError(null);
      try {
        const url = await toViewSrc(photo.filePath);
        setImgUrl(url);
        const flist = await listFaces(photo.id);
        setFaces(flist);
        const plist = await listPeople();
        setPeople(plist);
        // tags/albums (best-effort fallbacks)
        try {
          setTags(await listTags());
        } catch {
          setTags([]);
        }
        try {
          setPhotoTags(await listPhotoTags(photo.id));
        } catch {
          setPhotoTags([]);
        }
        try {
          setAlbums(await listAlbums());
        } catch {
          setAlbums([]);
        }
      } catch (e) {
        setError(String(e));
      }
    }
    if (open && photo) init();
  }, [open, photo]);

  const scale = useMemo(() => {
    const el = imgRef.current;
    if (!el) return { sx: 1, sy: 1 };
    const sx = el.clientWidth / imgNatural.w;
    const sy = el.clientHeight / imgNatural.h;
    return { sx, sy };
  }, [imgNatural]);

  const runDetection = async () => {
    if (!photo) return;
    setLoading(true);
    setError(null);
    try {
      const det = await detectFacesOnPath(photo.filePath);
      await saveFaceDetections(photo.id, "face-api@1.7.15", det);
      const updated = await listFaces(photo.id);
      setFaces(updated);
      onFacesUpdated?.();
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const handleAssign = async (faceId: string, personId: string | "") => {
    if (!photo) return;
    setLoading(true);
    setError(null);
    try {
      await assignFacePerson(faceId, personId || undefined);
      const updated = await listFaces(photo.id);
      setFaces(updated);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const handleCreatePerson = async () => {
    if (!newPersonName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const p = await createPerson({ name: newPersonName.trim() });
      setPeople((prev) => [...prev, p]);
      setNewPersonName("");
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !photo) return;
    setLoading(true);
    setError(null);
    try {
      const t = await createTag(newTagName.trim());
      setTags((prev) => [...prev, t]);
      await assignTag(photo.id, t.id);
      setPhotoTags(await listPhotoTags(photo.id));
      setNewTagName("");
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const toggleTag = async (tagId: string) => {
    if (!photo) return;
    setLoading(true);
    setError(null);
    try {
      const has = !!photoTags.find((t) => t.id === tagId);
      if (has) await removeTag(photo.id, tagId);
      else await assignTag(photo.id, tagId);
      setPhotoTags(await listPhotoTags(photo.id));
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim() || !photo) return;
    setLoading(true);
    setError(null);
    try {
      const a = await createAlbum(newAlbumName.trim());
      setAlbums((prev) => [...prev, a]);
      await addPhotoToAlbum(a.id, photo.id);
      setNewAlbumName("");
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const toggleAlbum = async (albumId: string) => {
    if (!photo) return;
    setLoading(true);
    setError(null);
    try {
      // Simple toggle: try to remove, if none removed then add
      await removePhotoFromAlbum(albumId, photo.id).catch(async () => {
        await addPhotoToAlbum(albumId, photo.id);
      });
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Photo Details</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            flexDirection: { xs: "column", md: "row" },
          }}
        >
          <Box sx={{ flex: 2, position: "relative" }}>
            <img
              ref={imgRef}
              src={imgUrl}
              alt={photo?.id}
              style={{
                width: "100%",
                height: "auto",
                borderRadius: 8,
                border: "1px solid #e0e0e0",
              }}
              onLoad={(e) => {
                const el = e.currentTarget;
                setImgNatural({ w: el.naturalWidth, h: el.naturalHeight });
              }}
            />
            {/* Face overlays */}
            {faces.map((f) => {
              const left = f.x * scale.sx;
              const top = f.y * scale.sy;
              const width = f.w * scale.sx;
              const height = f.h * scale.sy;
              return (
                <Box
                  key={f.id}
                  sx={{
                    position: "absolute",
                    left,
                    top,
                    width,
                    height,
                    border: "2px solid #00e5ff",
                    borderRadius: 1,
                    pointerEvents: "none",
                  }}
                />
              );
            })}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Stack spacing={2}>
              <Button
                variant="contained"
                onClick={runDetection}
                disabled={loading || !photo}
              >
                {loading ? <CircularProgress size={18} /> : "Detect Faces"}
              </Button>
              <Typography variant="subtitle1">Faces</Typography>
              {faces.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No faces saved.
                </Typography>
              )}
              {faces.map((f) => (
                <Box
                  key={f.id}
                  sx={{ border: "1px solid #eee", borderRadius: 1, p: 1 }}
                >
                  <Typography variant="caption">
                    Box:{" "}
                    {`${Math.round(f.x)},${Math.round(f.y)} ${Math.round(f.w)}x${Math.round(f.h)}`}
                  </Typography>
                  <Select
                    size="small"
                    value={f.person_id ?? ""}
                    onChange={(e) =>
                      handleAssign(f.id, e.target.value as string)
                    }
                    displayEmpty
                    fullWidth
                    sx={{ mt: 1 }}
                  >
                    <MenuItem value="">
                      <em>Unassigned</em>
                    </MenuItem>
                    {people.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              ))}
              <Box sx={{ borderTop: "1px solid #eee", pt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Add Person
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    label="Name"
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    fullWidth
                  />
                  <Button
                    variant="outlined"
                    onClick={handleCreatePerson}
                    disabled={loading || !newPersonName.trim()}
                  >
                    Create
                  </Button>
                </Stack>
              </Box>
              <Box sx={{ borderTop: "1px solid #eee", pt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Tags
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                  {tags.map((t) => {
                    const has = !!photoTags.find((pt) => pt.id === t.id);
                    return (
                      <Button
                        key={t.id}
                        size="small"
                        variant={has ? "contained" : "outlined"}
                        onClick={() => toggleTag(t.id)}
                        sx={{ mb: 1 }}
                      >
                        {t.name}
                      </Button>
                    );
                  })}
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <TextField
                    size="small"
                    label="New tag"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    fullWidth
                  />
                  <Button
                    variant="outlined"
                    onClick={handleCreateTag}
                    disabled={loading || !newTagName.trim()}
                  >
                    Add
                  </Button>
                </Stack>
              </Box>
              <Box sx={{ borderTop: "1px solid #eee", pt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Albums
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                  {albums.map((a) => (
                    <Button
                      key={a.id}
                      size="small"
                      variant={"outlined"}
                      onClick={() => toggleAlbum(a.id)}
                      sx={{ mb: 1 }}
                    >
                      {a.name}
                    </Button>
                  ))}
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <TextField
                    size="small"
                    label="New album"
                    value={newAlbumName}
                    onChange={(e) => setNewAlbumName(e.target.value)}
                    fullWidth
                  />
                  <Button
                    variant="outlined"
                    onClick={handleCreateAlbum}
                    disabled={loading || !newAlbumName.trim()}
                  >
                    Create
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
