import React, { useEffect, useState, useCallback } from "react";
import {
  getQuietHours,
  createQuietHour,
  updateQuietHour,
  deleteQuietHour,
  QuietHourPeriod,
  QuietHourInput,
} from "../api/quietHoursApi";
import {
  Box,
  Button,
  Typography,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  Snackbar,
  Alert,
} from "@mui/material";
import { Add, Edit, Delete } from "@mui/icons-material";

// Utility function to format time in HH:mm
const formatTime = (time: string) => {
  if (!time) return "";
  const [h, m] = time.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
};

// Validation for quiet hour input
const validateQuietHourInput = (
  input: QuietHourInput,
  existing: QuietHourPeriod[],
  editingId?: string
): string | null => {
  // Check time format
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(input.startTime) || !timeRegex.test(input.endTime)) {
    return "Start and end times must be in HH:mm format.";
  }

  // Check that end is after start (allow overnight, e.g., 22:00-07:00)
  if (input.startTime === input.endTime) {
    return "Start and end times cannot be the same.";
  }

  // Check for overlapping periods
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const inputStart = toMinutes(input.startTime);
  const inputEnd = toMinutes(input.endTime);

  // Helper to check overlap, considering overnight periods
  const periodsOverlap = (
    s1: number,
    e1: number,
    s2: number,
    e2: number
  ): boolean => {
    // Normalize overnight
    const range1 = e1 > s1 ? [[s1, e1]] : [[s1, 1440], [0, e1]];
    const range2 = e2 > s2 ? [[s2, e2]] : [[s2, 1440], [0, e2]];
    for (const [a1, a2] of range1) {
      for (const [b1, b2] of range2) {
        if (a1 < b2 && b1 < a2) return true;
      }
    }
    return false;
  };

  for (const period of existing) {
    if (editingId && period.id === editingId) continue;
    const s2 = toMinutes(period.startTime);
    const e2 = toMinutes(period.endTime);
    if (periodsOverlap(inputStart, inputEnd, s2, e2)) {
      return "Quiet hour periods cannot overlap.";
    }
  }

  return null;
};

type QuietHourFormProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: QuietHourInput) => void;
  initial?: QuietHourInput;
  loading: boolean;
  error: string | null;
};

const QuietHourForm: React.FC<QuietHourFormProps> = ({
  open,
  onClose,
  onSubmit,
  initial,
  loading,
  error,
}) => {
  const [startTime, setStartTime] = useState(initial?.startTime || "");
  const [endTime, setEndTime] = useState(initial?.endTime || "");

  useEffect(() => {
    setStartTime(initial?.startTime || "");
    setEndTime(initial?.endTime || "");
  }, [initial, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ startTime, endTime });
  };

  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="quiet-hour-form-title">
      <DialogTitle id="quiet-hour-form-title">
        {initial ? "Edit Quiet Hour" : "Add Quiet Hour"}
      </DialogTitle>
      <form onSubmit={handleSubmit} autoComplete="off">
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2}>
            <TextField
              label="Start Time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              inputProps={{ step: 60 }}
              required
              fullWidth
            />
            <TextField
              label="End Time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              inputProps={{ step: 60 }}
              required
              fullWidth
            />
            {error && (
              <Alert severity="error" data-testid="form-error">
                {error}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" color="primary" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : initial ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

const QuietHoursSettings: React.FC = () => {
  const [quietHours, setQuietHours] = useState<QuietHourPeriod[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [editQuietHour, setEditQuietHour] = useState<QuietHourPeriod | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  // Fetch quiet hours on mount
  const fetchQuietHours = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getQuietHours();
      setQuietHours(data);
    } catch (err) {
      setSnackbar({
        open: true,
        message: "Failed to load quiet hour settings.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuietHours();
  }, [fetchQuietHours]);

  // Handle add/edit form open
  const handleOpenForm = (qh?: QuietHourPeriod) => {
    setFormError(null);
    setEditQuietHour(qh || null);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditQuietHour(null);
    setFormError(null);
  };

  // Handle add or update
  const handleFormSubmit = async (input: QuietHourInput) => {
    setFormError(null);
    setFormLoading(true);

    // Validate input
    const validationError = validateQuietHourInput(
      input,
      quietHours,
      editQuietHour?.id
    );
    if (validationError) {
      setFormError(validationError);
      setFormLoading(false);
      return;
    }

    try {
      if (editQuietHour) {
        await updateQuietHour(editQuietHour.id, input);
        setSnackbar({
          open: true,
          message: "Quiet hour updated successfully.",
          severity: "success",
        });
      } else {
        await createQuietHour(input);
        setSnackbar({
          open: true,
          message: "Quiet hour added successfully.",
          severity: "success",
        });
      }
      await fetchQuietHours();
      handleCloseForm();
    } catch (err: any) {
      setFormError(
        err?.response?.data?.message ||
          "Failed to save quiet hour. Please try again."
      );
    } finally {
      setFormLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      await deleteQuietHour(id);
      setSnackbar({
        open: true,
        message: "Quiet hour deleted.",
        severity: "success",
      });
      await fetchQuietHours();
    } catch (err) {
      setSnackbar({
        open: true,
        message: "Failed to delete quiet hour.",
        severity: "error",
      });
    } finally {
      setDeleteId(null);
      setDeleteLoading(false);
    }
  };

  // Render
  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 600, margin: "0 auto" }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" component="h2">
          Quiet Hours Settings
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => handleOpenForm()}
          data-testid="add-quiet-hour"
        >
          Add Quiet Hour
        </Button>
      </Box>
      <Typography variant="body2" color="textSecondary" mb={2}>
        Set periods during which push notifications will be suppressed or queued. Quiet hours apply across all your devices and time zones are based on your current device.
      </Typography>
      {loading ? (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      ) : (
        <List>
          {quietHours.length === 0 ? (
            <Typography variant="body1" color="textSecondary" align="center" mt={2}>
              No quiet hours set.
            </Typography>
          ) : (
            quietHours.map((qh) => (
              <ListItem key={qh.id} divider>
                <ListItemText
                  primary={`${formatTime(qh.startTime)} – ${formatTime(qh.endTime)}`}
                  secondary="Notifications will be suppressed during this period."
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="edit"
                    onClick={() => handleOpenForm(qh)}
                    data-testid={`edit-quiet-hour-${qh.id}`}
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    color="error"
                    onClick={() => setDeleteId(qh.id)}
                    data-testid={`delete-quiet-hour-${qh.id}`}
                  >
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>
      )}

      {/* Add/Edit Form Dialog */}
      <QuietHourForm
        open={formOpen}
        onClose={handleCloseForm}
        onSubmit={handleFormSubmit}
        initial={editQuietHour ? { startTime: editQuietHour.startTime, endTime: editQuietHour.endTime } : undefined}
        loading={formLoading}
        error={formError}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        aria-labelledby="delete-quiet-hour-title"
      >
        <DialogTitle id="delete-quiet-hour-title">Delete Quiet Hour?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this quiet hour period? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button
            onClick={() => deleteId && handleDelete(deleteId)}
            color="error"
            variant="contained"
            disabled={deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={20} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default QuietHoursSettings;