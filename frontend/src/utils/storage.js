// src/utils/storage.js
// LocalStorage utility functions for workout data

// =====================
// Versioning
// =====================
const STORAGE_VERSION = 6;
const STORAGE_VERSION_KEY = "gym_storage_version";

// =====================
// Storage Keys
// =====================
export const STORAGE_KEYS = {
  WORKOUTS: "gym_workouts",
  SETTINGS: "gym_settings",
  BODY_WEIGHT: "gym_body_weight",
  PERSONAL_RECORDS: "gym_personal_records",
  VIDEO_LINKS: "gym_video_links",
  PROGRAMMES: "gym_programmes",
  EXERCISES: "gym_exercises",
  PROGRESSION_SETTINGS: "gym_progression_settings",
  WORKOUT_PATTERN: "gym_workout_pattern",
  WORKOUT_PATTERN_INDEX: "gym_workout_pattern_index",
};

// =====================
// Helpers
// =====================
const normalizeId = (s) => (s || "").toString().trim();

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// Legacy / archived exercises we never want to lose
const LEGACY_EXERCISES = [
  {
    id: "seated_cable_rows",
    name: "Seated Cable Rows",
    sets: 3,
    repScheme: "RPT",
    goalReps: [8, 10, 12],
    restTime: 150,
    notes: "Pull to lower chest, squeeze shoulder blades",
    assignedTo: [],
    hidden: false,
  },
  {
    id: "db_romanian_deadlifts",
    name: "DB Romanian Deadlifts",
    sets: 3,
    repScheme: "RPT",
    goalReps: [6, 8, 10],
    restTime: 120,
    notes: "Hip hinge. Push hips back, neutral spine.",
    assignedTo: [],
    hidden: false,
  },
];

// =====================
// Low-level storage
// =====================
export const getStorageData = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error(`Failed to read ${key}`, e);
    return null;
  }
};

export const setStorageData = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`Failed to write ${key}`, e);
    return false;
  }
};

// =====================
// Init + migration
// =====================
export const initStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_VERSION_KEY);
    const version = stored ? parseInt(stored, 10) : 0;

    // ---- Migration to v6 ----
    // Rebuild exercise catalogue so legacy/default exercises are never lost
    if (version < 6) {
      const programmes = getProgrammes();
      const existing = getStorageData(STORAGE_KEYS.EXERCISES) || [];
      const rebuilt = rebuildExerciseCatalogue(programmes, existing);
      setStorageData(STORAGE_KEYS.EXERCISES, rebuilt);
    }

    localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION.toString());
  } catch (e) {
    console.error("Storage init failed", e);
  }
};

// =====================
// Programmes
// =====================
export const getProgrammes = () => {
  const programmes = getStorageData(STORAGE_KEYS.PROGRAMMES);
  if (Array.isArray(programmes) && programmes.length > 0) return programmes;

  // Initialise from workoutData
  const { WORKOUT_A, WORKOUT_B } = require("../data/workoutData");
  const defaults = [WORKOUT_A, WORKOUT_B];
  setStorageData(STORAGE_KEYS.PROGRAMMES, defaults);
  return defaults;
};

// =====================
// Exercises (SAFE)
// =====================
function getDefaultExercisesFromWorkoutData() {
  try {
    const { WORKOUT_A, WORKOUT_B } = require("../data/workoutData");
    return [
      ...(WORKOUT_A?.exercises || []),
      ...(WORKOUT_B?.exercises || []),
    ];
  } catch {
    return [];
  }
}

function rebuildExerciseCatalogue(programmes, existingExercises) {
  const byId = new Map();

  const add = (ex) => {
    if (!ex?.id) return;
    const id = normalizeId(ex.id);
    const prev = byId.get(id) || {};
    byId.set(id, { ...prev, ...ex, id });
  };

  (existingExercises || []).forEach(add);
  getDefaultExercisesFromWorkoutData().forEach(add);
  LEGACY_EXERCISES.forEach(add);

  // Recompute assignedTo from programmes
  const assignedMap = new Map();
  (programmes || []).forEach((p) => {
    const type = p?.type;
    (p?.exercises || []).forEach((ex) => {
      if (!ex?.id || !type) return;
      const id = normalizeId(ex.id);
      if (!assignedMap.has(id)) assignedMap.set(id, new Set());
      assignedMap.get(id).add(type);
    });
  });

  return Array.from(byId.values()).map((ex) => ({
    ...ex,
    assignedTo: assignedMap.has(ex.id)
      ? Array.from(assignedMap.get(ex.id))
      : ex.assignedTo || [],
  }));
}

export const getExercises = () => {
  const stored = getStorageData(STORAGE_KEYS.EXERCISES) || [];
  const programmes = getProgrammes();
  const merged = rebuildExerciseCatalogue(programmes, stored);
  setStorageData(STORAGE_KEYS.EXERCISES, merged);
  return merged;
};

export const saveExercise = (exercise) => {
  const exercises = getStorageData(STORAGE_KEYS.EXERCISES) || [];
  const id = normalizeId(exercise?.id);
  if (!id) return false;

  const idx = exercises.findIndex((e) => normalizeId(e.id) === id);
  if (idx !== -1) {
    const prev = exercises[idx];
    exercises[idx] = {
      ...prev,
      ...exercise,
      id,
      hidden:
        typeof exercise.hidden === "boolean"
          ? exercise.hidden
          : prev.hidden,
    };
  } else {
    exercises.push({ ...exercise, id });
  }

  return setStorageData(STORAGE_KEYS.EXERCISES, exercises);
};

export const deleteExercise = (id) => {
  const exercises = getStorageData(STORAGE_KEYS.EXERCISES) || [];
  const filtered = exercises.filter((e) => normalizeId(e.id) !== normalizeId(id));
  return setStorageData(STORAGE_KEYS.EXERCISES, filtered);
};

// =====================
// Workouts
// =====================
export const getWorkouts = () =>
  getStorageData(STORAGE_KEYS.WORKOUTS) || [];

export const saveWorkout = (workout) => {
  const workouts = getWorkouts();
  workouts.unshift({
    ...workout,
    id: workout.id || Date.now().toString(),
    date: workout.date || new Date().toISOString(),
  });
  return setStorageData(STORAGE_KEYS.WORKOUTS, workouts);
};
export const updateWorkout = (id, updates) => {
  const workouts = getWorkouts();
  const index = workouts.findIndex((w) => w.id === id);
  if (index === -1) return false;

  workouts[index] = { ...workouts[index], ...updates };
  return setStorageData(STORAGE_KEYS.WORKOUTS, workouts);
};

export const deleteWorkout = (id) => {
  const workouts = getWorkouts();
  const filtered = workouts.filter((w) => w.id !== id);
  return setStorageData(STORAGE_KEYS.WORKOUTS, filtered);
};

// =====================
// Settings
// =====================
export const getSettings = () =>
  getStorageData(STORAGE_KEYS.SETTINGS) || {
    weightUnit: "kg",
    theme: "dark",
  };

export const updateSettings = (updates) =>
  setStorageData(STORAGE_KEYS.SETTINGS, {
    ...getSettings(),
    ...updates,
  });

// =====================
// Personal Records (PRs) — backwards compatible
// =====================

// Old behaviour used "exercise name" -> key: lower + underscores
const toLegacyPrKey = (s) =>
  (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

// Canonical key: prefer IDs if they already look like IDs, otherwise legacy transform
const toPrKey = (exerciseIdOrName) => {
  const raw = normalizeId(exerciseIdOrName);
  if (!raw) return "";

  // If it already looks like an ID (contains underscore, no spaces), keep it
  if (raw.includes("_") && !raw.includes(" ")) return raw.toLowerCase();

  // Otherwise fall back to legacy transform
  return toLegacyPrKey(raw);
};

export const getPersonalRecords = () => {
  const prs = getStorageData(STORAGE_KEYS.PERSONAL_RECORDS) || {};

  // Ensure each PR has exerciseName populated (for UI like StatsPage)
  // (does not change keys)
  let changed = false;
  Object.keys(prs).forEach((k) => {
    if (prs[k] && !prs[k].exerciseName) {
      prs[k].exerciseName = k.replace(/_/g, " ");
      changed = true;
    }
  });

  if (changed) setStorageData(STORAGE_KEYS.PERSONAL_RECORDS, prs);
  return prs;
};

/**
 * Backwards compatible updater:
 * - Accepts exerciseId OR exerciseName as first param
 * - Stores PR under a stable key (underscored)
 * - Fills exerciseName for UI
 * - Only overwrites PR if weight increases (same rule as before)
 */
export const updatePersonalRecord = (exerciseIdOrName, weight, reps, date) => {
  const prs = getPersonalRecords();

  const key = toPrKey(exerciseIdOrName);
  if (!key) return false;

  const w = Number(weight);
  const r = Number(reps);

  if (!Number.isFinite(w) || w <= 0) return false;
  if (!Number.isFinite(r) || r <= 0) return false;

  const prev = prs[key];
  const prevWeight = prev ? Number(prev.weight || 0) : 0;

  // Build a friendly name for display
  const displayName =
    prev?.exerciseName ||
    (normalizeId(exerciseIdOrName).includes("_")
      ? key.replace(/_/g, " ")
      : normalizeId(exerciseIdOrName));

  if (!prev || w > prevWeight) {
    prs[key] = {
      exerciseName: displayName,
      weight: w,
      reps: r,
      date: date || new Date().toISOString(),
      previousWeight: prev?.weight ?? null,
    };
    setStorageData(STORAGE_KEYS.PERSONAL_RECORDS, prs);
    return true;
  }

  return false;
};

// =====================
// Video links
// =====================
export const getVideoLinks = () =>
  getStorageData(STORAGE_KEYS.VIDEO_LINKS) || {};

export const updateVideoLink = (exerciseId, url) => {
  const links = getVideoLinks();
  links[normalizeId(exerciseId)] = url;
  return setStorageData(STORAGE_KEYS.VIDEO_LINKS, links);
};

// =====================
// Progression
// =====================
export const getProgressionSettings = () =>
  getStorageData(STORAGE_KEYS.PROGRESSION_SETTINGS) || {
    globalIncrementKg: 2.5,
    globalIncrementLbs: 5,
    rptSet2Percentage: 90,
    rptSet3Percentage: 80,
    exerciseSpecific: {},
  };

export const updateProgressionSettings = (settings) =>
  setStorageData(STORAGE_KEYS.PROGRESSION_SETTINGS, settings);

// =====================
// Workout Pattern Helpers
// =====================
export const getWorkoutPattern = () => {
  // Default pattern if user never sets one
  return getStorageData(STORAGE_KEYS.WORKOUT_PATTERN) || "A,B";
};

export const setWorkoutPattern = (patternString) => {
  // Store raw string (validated elsewhere)
  return setStorageData(STORAGE_KEYS.WORKOUT_PATTERN, patternString);
};

export const getWorkoutPatternIndex = () => {
  return getStorageData(STORAGE_KEYS.WORKOUT_PATTERN_INDEX) || 0;
};

export const setWorkoutPatternIndex = (index) => {
  return setStorageData(STORAGE_KEYS.WORKOUT_PATTERN_INDEX, index);
};

// Parse "A,B,B,C" -> ["A","B","B","C"]
export const parseWorkoutPattern = (patternString) => {
  return (patternString || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
};

// "Usable" programmes = have 1+ exercises
export const getUsableProgrammes = () => {
  return getProgrammes().filter(
    (p) => Array.isArray(p.exercises) && p.exercises.length > 0
  );
};

// Decide next workout type from pattern + usable programmes
export const getNextWorkoutTypeFromPattern = () => {
  const usable = getUsableProgrammes();
  if (usable.length === 0) return null;

  const usableTypes = new Set(usable.map((p) => String(p.type).toUpperCase()));

  const patternStr = getWorkoutPattern();
  const pattern = parseWorkoutPattern(patternStr);

  // If pattern empty, fall back to alphabetical usable types
  const safePattern = pattern.length > 0 ? pattern : Array.from(usableTypes).sort();

  // Filter pattern to only usable types
  const filtered = safePattern.filter((t) => usableTypes.has(t));

  // If user entered only invalid letters, fall back again
  const finalPattern = filtered.length > 0 ? filtered : Array.from(usableTypes).sort();

  const i = getWorkoutPatternIndex() % finalPattern.length;
  const nextType = finalPattern[i];

  // Advance index for next time
  setWorkoutPatternIndex((i + 1) % finalPattern.length);

  return nextType;
};

// =====================
// Force Update
// =====================
export const resetAllLocalData = async () => {
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem(STORAGE_VERSION_KEY);

  if (typeof caches !== "undefined") {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
  }
  return true;
};