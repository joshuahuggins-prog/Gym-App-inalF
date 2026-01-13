// frontend/src/components/ExerciseCard.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Timer, Award, Video, Shuffle } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { toast } from "sonner";

import {
  getProgressionSettings,
  getVideoLinks,
  getPersonalRecords,
} from "../utils/storage";

// ✅ pull alternatives from your workoutData
import { EXERCISE_ALTERNATIVES } from "../data/workoutData";

const clampInt = (n, min, max) => Math.max(min, Math.min(max, Math.trunc(n)));

const normalizeGoalReps = (goalReps, count) => {
  const arr = Array.isArray(goalReps) ? goalReps : [];
  const base = arr.length ? arr : [8];
  if (base.length < count) return [...base, ...Array.from({ length: count - base.length }, () => base[base.length - 1] ?? 8)];
  if (base.length > count) return base.slice(0, count);
  return base;
};

const normalizeSets = (setsData, count) => {
  const base = Array.isArray(setsData) ? setsData : [];
  const out = [];
  for (let i = 0; i < count; i++) {
    const s = base[i] || {};
    out.push({
      weight: s.weight ?? "",
      reps: s.reps ?? "",
      completed: !!s.completed,
    });
  }
  return out;
};

const ExerciseCard = ({
  exercise,
  lastWorkoutData,
  onSetComplete,
  onWeightChange,
  onNotesChange,
  onRestTimer,
}) => {
  const setsCount = clampInt(Number(exercise?.sets ?? 3), 1, 12);
  const goalReps = useMemo(() => normalizeGoalReps(exercise?.goalReps, setsCount), [exercise?.goalReps, setsCount]);

  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(exercise?.userNotes || "");
  const [videoLink, setVideoLink] = useState("");
  const [sets, setSets] = useState(() => normalizeSets(exercise?.setsData, setsCount));

  // ✅ assisted if any weight is negative
  const [mode, setMode] = useState(() =>
    (exercise?.setsData || []).some((s) => Number(s.weight) < 0) ? "assisted" : "weighted"
  );

  // ✅ alternatives panel
  const [showAlternatives, setShowAlternatives] = useState(false);

  const hydrateKey = useRef("");

  // PR from storage (display only)
  const pr = useMemo(() => {
    const prs = getPersonalRecords?.() || {};
    return prs[exercise?.id] || null;
  }, [exercise?.id]);

  // best weight from THIS workout (for display label)
  const bestFromWorkout = useMemo(() => {
    const nums = (sets || [])
      .map((s) => (s.weight === "" ? null : Number(s.weight)))
      .filter((n) => Number.isFinite(n));
    if (!nums.length) return null;
    return Math.max(...nums.map((n) => Math.abs(n)));
  }, [sets]);

  // hydrate on exercise updates
  useEffect(() => {
    const key = `${exercise?.id || ""}__${setsCount}__${JSON.stringify(exercise?.setsData || [])}__${JSON.stringify(goalReps)}`;
    if (key === hydrateKey.current) return;
    hydrateKey.current = key;

    setSets(normalizeSets(exercise?.setsData, setsCount));
    setNotes(exercise?.userNotes || "");
    setMode((exercise?.setsData || []).some((s) => Number(s.weight) < 0) ? "assisted" : "weighted");

    const links = getVideoLinks();
    setVideoLink(links?.[exercise?.id] || "");

    // don’t force-open alternatives on hydrate
    setShowAlternatives(false);
  }, [exercise, setsCount, goalReps]);

  const pushUp = (nextSets) => {
    setSets(nextSets);

    onWeightChange?.(
      exercise,
      nextSets.map((s) => ({
        weight: s.weight === "" ? "" : Number(s.weight),
        reps: s.reps === "" ? "" : Number(s.reps),
        completed: !!s.completed,
      }))
    );
  };

  const toggleMode = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);

    const converted = sets.map((s) => {
      if (s.weight === "") return s;
      const v = Math.abs(Number(s.weight));
      return { ...s, weight: nextMode === "assisted" ? -v : v };
    });

    pushUp(converted);
  };

  const completedCount = useMemo(() => sets.filter((s) => s.completed).length, [sets]);

  const maxLabel = useMemo(() => {
    const best = pr?.weight != null ? Math.abs(Number(pr.weight)) : bestFromWorkout;
    if (!Number.isFinite(best) || best === 0) return null;
    const label = mode === "assisted" ? "Assist max" : "Max";
    return `${label}: ${best}`;
  }, [pr, bestFromWorkout, mode]);

  const alternatives = useMemo(() => {
    if (!exercise?.id) return [];
    const list = EXERCISE_ALTERNATIVES?.[exercise.id];
    return Array.isArray(list) ? list : [];
  }, [exercise?.id]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        className="w-full text-left p-4"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold truncate text-foreground">
              {exercise?.name || "Exercise"}
            </h3>

            {/* Row 2 */}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {completedCount}/{setsCount} sets
              </span>

              {exercise?.repScheme ? (
                <Badge variant="secondary" className="text-[10px]">
                  {exercise.repScheme}
                </Badge>
              ) : null}

              {pr?.weight != null && (
                <span className="text-foreground font-semibold">
                  PR: {pr.weight} × {pr.reps}
                </span>
              )}
            </div>

            {/* Row 3: toggle ALWAYS in same place */}
            <div
              className="mt-2 inline-flex border border-border rounded-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={`px-2 py-1 text-[11px] ${
                  mode === "weighted"
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:bg-muted/40"
                }`}
                onClick={() => toggleMode("weighted")}
              >
                Weighted
              </button>
              <button
                type="button"
                className={`px-2 py-1 text-[11px] ${
                  mode === "assisted"
                    ? "bg-orange-500/20 text-orange-600"
                    : "text-muted-foreground hover:bg-muted/40"
                }`}
                onClick={() => toggleMode("assisted")}
              >
                Assisted
              </button>
            </div>
          </div>

          {/* Right-side icons */}
          <div className="flex items-center gap-1 shrink-0">
            {videoLink ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(videoLink, "_blank", "noopener,noreferrer");
                }}
                title="Open form video"
              >
                <Video className="w-4 h-4" />
              </Button>
            ) : null}

            {expanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* label ABOVE sets */}
          {maxLabel && (
            <div className="text-xs text-muted-foreground">
              <span
                className={
                  mode === "assisted"
                    ? "text-orange-600 font-semibold"
                    : "text-foreground font-semibold"
                }
              >
                {maxLabel}
              </span>
            </div>
          )}

          {/* Sets */}
          <div className="space-y-2">
            {sets.map((s, i) => (
              <div
                key={i}
                className="grid grid-cols-[60px_1fr_1fr_40px] gap-2 items-center"
              >
                <span className="text-xs text-muted-foreground">Set {i + 1}</span>

                <Input
                  type="number"
                  value={s.weight === "" ? "" : Math.abs(Number(s.weight))}
                  placeholder={mode === "assisted" ? "Assist" : "Weight"}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next = [...sets];

                    if (raw === "") {
                      next[i] = { ...s, weight: "" };
                      pushUp(next);
                      return;
                    }

                    const n = Number(raw);
                    if (!Number.isFinite(n)) return;

                    next[i] = { ...s, weight: mode === "assisted" ? -n : n };
                    pushUp(next);
                  }}
                />

                <Input
                  type="number"
                  value={s.reps}
                  // ✅ restore “goal reps as grey hint”
                  placeholder={`${goalReps[i] ?? 8}`}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next = [...sets];
                    next[i] = { ...s, reps: raw === "" ? "" : Number(raw) };
                    pushUp(next);
                  }}
                />

                <Button
                  size="sm"
                  variant={s.completed ? "default" : "outline"}
                  onClick={() => {
                    const next = [...sets];
                    next[i] = { ...s, completed: !s.completed };
                    pushUp(next);
                    onSetComplete?.(exercise, next[i], false);

                    // ✅ start timer only when marking complete (and not last set)
                    if (!s.completed && i < sets.length - 1) {
                      onRestTimer?.(exercise?.restTime ?? 120);
                    }
                  }}
                  title={s.completed ? "Completed" : "Mark completed"}
                >
                  ✓
                </Button>
              </div>
            ))}
          </div>

          {/* Notes input (user notes) */}
          <Textarea
            value={notes}
            placeholder="Notes…"
            className="min-h-[70px]"
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => onNotesChange?.(exercise, notes)}
          />

          {/* ✅ Exercise info notes (template notes) */}
          {exercise?.notes ? (
            <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg border border-border">
              {exercise.notes}
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {alternatives.length ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAlternatives((v) => !v)}
              >
                <Shuffle className="w-4 h-4 mr-1" />
                Alternatives
              </Button>
            ) : null}

            {onRestTimer ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRestTimer?.(exercise?.restTime ?? 120)}
              >
                <Timer className="w-4 h-4 mr-1" />
                Rest
              </Button>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const p = getProgressionSettings();
                const inc = p.exerciseSpecific?.[exercise.id];
                toast.message("Progression", {
                  description: inc
                    ? `Exercise increment: ${inc}`
                    : "Global progression applies",
                });
              }}
            >
              <Award className="w-4 h-4 mr-1" />
              Progression
            </Button>
          </div>

          {/* Alternatives panel */}
          {showAlternatives && alternatives.length ? (
            <div className="p-3 bg-muted/30 rounded-lg border border-border">
              <div className="text-sm font-medium text-foreground mb-2">
                Alternatives
              </div>
              <div className="flex flex-wrap gap-2">
                {alternatives.map((alt, idx) => (
                  <Badge key={`${exercise.id}-alt-${idx}`} variant="secondary">
                    {alt}
                  </Badge>
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                (This is read-only for now — we can wire swapping later.)
              </div>
            </div>
          ) : null}

          {/* Last workout */}
          {lastWorkoutData ? (
            <div className="text-xs text-muted-foreground border border-border rounded-lg p-3 bg-muted/20">
              <div className="font-semibold text-foreground mb-1">Last time</div>
              {(lastWorkoutData.sets || []).map((s2, i2) => (
                <div key={i2}>
                  Set {i2 + 1}: {s2.weight} × {s2.reps}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ExerciseCard;
