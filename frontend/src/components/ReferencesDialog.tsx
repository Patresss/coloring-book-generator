import React from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { api, ReferenceItem } from '../api/client';
import { sky, skyGradient } from '../theme';
import { joinPersonName, splitPersonName } from './PeopleChips';

type ReferencesDialogProps = {
  open: boolean;
  isMobile: boolean;
  onClose: () => void;
};

const errorText = (e: unknown) => {
  const raw = String((e as any)?.message || e);
  try {
    return JSON.parse(raw)?.error || raw;
  } catch {
    return raw;
  }
};

const roundIcon = {
  width: 34,
  height: 34,
  borderRadius: '11px',
  color: sky.muted,
  '& svg': { fontSize: 20 },
} as const;

/* ---------- add / edit form ---------- */

type PersonForm =
  | { mode: 'add'; file?: File }
  | { mode: 'edit'; item: ReferenceItem };

type PersonFormDialogProps = {
  form: PersonForm | null;
  isMobile: boolean;
  onCancel: () => void;
  onSaved: (item: ReferenceItem) => void;
};

const PersonFormDialog: React.FC<PersonFormDialogProps> = ({ form, isMobile, onCancel, onSaved }) => {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [role, setRole] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!form) return;
    setError(null);
    setBusy(false);
    if (form.mode === 'edit') {
      const parts = splitPersonName(form.item.name);
      setName(parts.name);
      setRole(parts.role);
      setFile(null);
    } else {
      setName('');
      setRole('');
      setFile(form.file ?? null);
    }
  }, [form]);

  // Object URL for the chosen photo, released when it changes
  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pickFile = (candidate?: File | null) => {
    if (!candidate) return;
    if (!candidate.type.startsWith('image/')) {
      setError('To nie jest zdjęcie');
      return;
    }
    setError(null);
    setFile(candidate);
  };

  const isEdit = form?.mode === 'edit';
  const imageSrc = isEdit ? form.item.url : preview;
  const canSave = !busy && name.trim().length > 0 && (isEdit || !!file);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || !canSave) return;
    setBusy(true);
    setError(null);
    try {
      const fullName = joinPersonName(name, role);
      const saved = form.mode === 'edit'
        ? await api.renameReference(form.item.name, fullName)
        : await api.addReference(file!, fullName);
      onSaved(saved);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!form} onClose={busy ? undefined : onCancel} fullWidth maxWidth="xs" fullScreen={isMobile} aria-labelledby="person-form-title">
      <Box component="form" onSubmit={save} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <DialogContent sx={{ pt: 3 }}>
          <Typography id="person-form-title" component="h2" sx={{ fontWeight: 800, fontSize: 22, mb: 2 }}>
            {isEdit ? 'Zmień nazwę' : 'Nowa osoba'}
          </Typography>

          <ButtonBase
            component="div"
            role={isEdit ? undefined : 'button'}
            tabIndex={isEdit ? -1 : 0}
            aria-label={isEdit ? undefined : 'Wybierz zdjęcie'}
            onClick={() => !isEdit && inputRef.current?.click()}
            onKeyDown={(e) => { if (!isEdit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); inputRef.current?.click(); } }}
            onDragOver={(e) => { if (!isEdit) { e.preventDefault(); setDragOver(true); } }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { if (!isEdit) { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); } }}
            disableRipple={isEdit}
            sx={{
              width: '100%',
              aspectRatio: '4 / 3',
              borderRadius: '18px',
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              cursor: isEdit ? 'default' : 'pointer',
              bgcolor: imageSrc ? '#fff' : dragOver ? sky.blueSoft : sky.blueTint,
              border: imageSrc ? `1px solid ${sky.line}` : `2px dashed ${dragOver ? sky.blue : '#A9CBEF'}`,
              transition: 'background-color .15s ease, border-color .15s ease',
            }}
          >
            {imageSrc ? (
              <Box component="img" src={imageSrc} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <Stack alignItems="center" spacing={1} sx={{ color: sky.blue, px: 2, textAlign: 'center' }}>
                <AddPhotoAlternateRoundedIcon sx={{ fontSize: 48 }} />
                <Typography sx={{ fontWeight: 800 }}>Wybierz zdjęcie</Typography>
                <Typography sx={{ fontSize: 13, color: sky.muted }}>
                  albo przeciągnij je tutaj. Najlepiej wyraźna twarz i cała postać.
                </Typography>
              </Stack>
            )}
          </ButtonBase>
          {!isEdit && file && (
            <Button size="small" onClick={() => inputRef.current?.click()} sx={{ mt: 1 }}>
              Zmień zdjęcie
            </Button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }}
          />

          <Stack spacing={2} sx={{ mt: 2.5 }}>
            <TextField
              label="Imię"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus={isEdit}
              inputProps={{ maxLength: 40 }}
              placeholder="np. Ala"
            />
            <TextField
              label="Kto to? (opcjonalnie)"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              inputProps={{ maxLength: 40 }}
              placeholder="np. mama, dziadek, ciocia"
              helperText={name.trim() ? `Plik: ${joinPersonName(name, role)}` : 'AI rozpoznaje osoby po imieniu i roli, np. „babcia Beata”.'}
            />
          </Stack>
          {error && <Alert severity="error" sx={{ mt: 2, borderRadius: '12px' }}>{error}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={onCancel} disabled={busy} sx={{ borderRadius: 999 }}>
            Anuluj
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!canSave}
            startIcon={busy ? <CircularProgress size={18} color="inherit" /> : undefined}
            sx={{ borderRadius: 999, px: 3 }}
          >
            {isEdit ? 'Zapisz' : 'Dodaj'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

/* ---------- main dialog ---------- */

export const ReferencesDialog: React.FC<ReferencesDialogProps> = ({ open, isMobile, onClose }) => {
  const [items, setItems] = React.useState<ReferenceItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<PersonForm | null>(null);
  const [toDelete, setToDelete] = React.useState<ReferenceItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [highlight, setHighlight] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      setItems(await api.listReferences());
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      setHighlight(null);
      load();
    }
  }, [open, load]);

  const onSaved = (saved: ReferenceItem) => {
    setForm(null);
    setHighlight(saved.name);
    load();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.deleteReference(toDelete.name);
      setToDelete(null);
      await load();
    } catch (e) {
      setError(errorText(e));
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const deleteName = toDelete ? splitPersonName(toDelete.name).name : '';

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullScreen={isMobile}
        fullWidth
        maxWidth="md"
        aria-labelledby="references-title"
        PaperProps={{
          sx: { background: skyGradient, height: isMobile ? '100%' : 'min(860px, calc(100% - 64px))' },
          onDragOver: (e: React.DragEvent) => { if (!form && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true); } },
          onDragLeave: (e: React.DragEvent) => { if (e.currentTarget === e.target) setDragOver(false); },
          onDrop: (e: React.DragEvent) => {
            if (form) return;
            e.preventDefault();
            setDragOver(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) setForm({ mode: 'add', file: dropped });
          },
        } as any}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: { xs: 1.5, sm: 2.5 }, minHeight: 64, bgcolor: 'background.paper', borderBottom: `1px solid ${sky.line}`, flex: 'none' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography id="references-title" component="h2" sx={{ fontWeight: 800, fontSize: '1.25rem', lineHeight: 1.2 }}>
              Osoby z rodziny
            </Typography>
            <Typography sx={{ fontSize: 13, color: sky.muted, display: { xs: 'none', sm: 'block' } }}>
              AI używa tych zdjęć, żeby narysować prawdziwe osoby. Rozpoznaje je po nazwie.
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Zamknij" sx={{ width: 44, height: 44, borderRadius: '14px', bgcolor: sky.blueTint, color: sky.ink }}>
            <CloseRoundedIcon />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 1.5, sm: 2.5 }, position: 'relative' }}>
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setError(null)}>{error}</Alert>}
          {items === null && !error ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress /></Box>
          ) : (
            <Box
              component="ul"
              sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(auto-fill, minmax(170px, 1fr))' }, gap: { xs: 1.25, sm: 2 } }}
            >
              <li>
                <ButtonBase
                  onClick={() => setForm({ mode: 'add' })}
                  sx={{
                    width: '100%',
                    height: '100%',
                    minHeight: 200,
                    borderRadius: '18px',
                    border: `2px dashed #A9CBEF`,
                    bgcolor: 'rgba(255,255,255,0.6)',
                    color: sky.blue,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    fontFamily: 'inherit',
                    fontWeight: 800,
                    fontSize: 16,
                    transition: 'background-color .15s ease',
                    '&:hover': { bgcolor: '#fff' },
                  }}
                >
                  <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: sky.blue, color: '#fff', display: 'grid', placeItems: 'center' }}>
                    <AddRoundedIcon sx={{ fontSize: 34 }} />
                  </Box>
                  Dodaj osobę
                </ButtonBase>
              </li>
              {(items ?? []).map((item) => {
                const { name, role } = splitPersonName(item.name);
                const isNew = highlight === item.name;
                return (
                  <Box
                    component="li"
                    key={item.name}
                    sx={{
                      bgcolor: 'background.paper',
                      borderRadius: '18px',
                      border: `1.5px solid ${isNew ? sky.blue : sky.line}`,
                      boxShadow: isNew ? `0 0 0 3px ${sky.blueSoft}` : sky.softShadow,
                      p: '6px',
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <Box
                      component="img"
                      src={item.url}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      sx={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', objectPosition: 'top', borderRadius: '13px', bgcolor: sky.blueTint, display: 'block' }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pt: 0.75, pl: 0.75 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {name}
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: sky.muted, minHeight: '1.2em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {role.toLocaleLowerCase('pl-PL')}
                        </Typography>
                      </Box>
                      <Tooltip title="Zmień nazwę" arrow>
                        <IconButton onClick={() => setForm({ mode: 'edit', item })} aria-label={`Zmień nazwę: ${name}`} sx={{ ...roundIcon, '&:hover': { bgcolor: sky.blueSoft, color: sky.blue } }}>
                          <EditRoundedIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Usuń" arrow>
                        <IconButton onClick={() => setToDelete(item)} aria-label={`Usuń: ${name}`} sx={{ ...roundIcon, '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.12)', color: 'error.main' } }}>
                          <DeleteOutlineRoundedIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
          {items?.length === 0 && (
            <Typography sx={{ color: sky.muted, fontWeight: 700, textAlign: 'center', mt: 3 }}>
              Nie ma jeszcze nikogo. Dodaj zdjęcie mamy, taty albo rodzeństwa.
            </Typography>
          )}
          {dragOver && (
            <Box sx={{ position: 'absolute', inset: 8, borderRadius: '20px', border: `3px dashed ${sky.blue}`, bgcolor: 'rgba(220, 235, 255, 0.85)', display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              <Typography sx={{ fontWeight: 800, fontSize: 20, color: sky.blue }}>Upuść zdjęcie, aby dodać osobę</Typography>
            </Box>
          )}
        </Box>
      </Dialog>

      <PersonFormDialog form={form} isMobile={isMobile} onCancel={() => setForm(null)} onSaved={onSaved} />

      <Dialog open={!!toDelete} onClose={deleting ? undefined : () => setToDelete(null)} maxWidth="xs" fullWidth aria-labelledby="delete-person-title">
        <DialogContent sx={{ textAlign: 'center', pt: 3 }}>
          {toDelete && (
            <Box component="img" src={toDelete.url} alt="" sx={{ width: 120, height: 150, objectFit: 'cover', objectPosition: 'top', borderRadius: '14px', border: `1px solid ${sky.line}`, mb: 2 }} />
          )}
          <Typography id="delete-person-title" component="h2" sx={{ fontWeight: 800, fontSize: 22 }}>
            Usunąć: {deleteName}?
          </Typography>
          <Typography sx={{ color: sky.muted, mt: 0.5 }}>
            AI przestanie rozpoznawać tę osobę. Zdjęcie trafi do folderu reference/.trash.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', gap: 1, pb: 2.5 }}>
          <Button onClick={() => setToDelete(null)} variant="outlined" size="large" disabled={deleting} autoFocus sx={{ borderRadius: 999, minWidth: 120 }}>
            Zostaw
          </Button>
          <Button onClick={confirmDelete} variant="contained" color="error" size="large" disabled={deleting} startIcon={<DeleteOutlineRoundedIcon />} sx={{ borderRadius: 999, minWidth: 120 }}>
            Usuń
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
