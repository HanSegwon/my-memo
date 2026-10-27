'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import Link from 'next/link';
import LoadingDots from '../../components/LoadingDots';

type BodyPart = 'upper' | 'lower';
type Intensity = 'easy' | 'normal' | 'hard';
type HealthExercise = {
  id: string;
  body_part: BodyPart;
  exercise_name: string;
  repetitions: number;
  sets: number;
  intensity: Intensity;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};
type ExerciseCard = Omit<HealthExercise, 'repetitions' | 'sets'> & {
  repetitions: string;
  sets: string;
  isDraft?: boolean;
};
type ReorderPress = {
  id: string;
  startY: number;
  pointerId: number;
  active: boolean;
  timer: number;
};

const BODY_PARTS: { id: BodyPart; label: string }[] = [
  { id: 'upper', label: '상체' },
  { id: 'lower', label: '하체' },
];
const INTENSITIES: { id: Intensity; label: string }[] = [
  { id: 'easy', label: '쉬움' },
  { id: 'normal', label: '보통' },
  { id: 'hard', label: '힘듬' },
];

function toCard(exercise: HealthExercise): ExerciseCard {
  return {
    ...exercise,
    repetitions: String(exercise.repetitions).padStart(2, '0'),
    sets: String(exercise.sets),
  };
}

export default function HealthRoutinePage() {
  const listRef = useRef<HTMLDivElement | null>(null);
  const reorderPress = useRef<ReorderPress | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(() => new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const [exercises, setExercises] = useState<ExerciseCard[]>([]);
  const [bodyPart, setBodyPart] = useState<BodyPart>('upper');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [error, setError] = useState('');

  const loadExercises = useCallback(async () => {
    const response = await fetch('/api/health-routine', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '헬스루틴을 불러오지 못했습니다.');
    setExercises((data.exercises ?? []).map((item: HealthExercise) => toCard(item)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/auth', { cache: 'no-store' });
        const data = await response.json();
        if (cancelled) return;
        setAuthenticated(Boolean(data.authenticated));
        if (data.authenticated) await loadExercises();
      } catch (loadError) {
        if (!cancelled) {
          setAuthenticated(false);
          setError(loadError instanceof Error ? loadError.message : '헬스루틴을 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadExercises]);

  const visibleExercises = exercises.filter((exercise) => exercise.body_part === bodyPart);

  function updateExercise(id: string, patch: Partial<Pick<ExerciseCard, 'exercise_name' | 'repetitions' | 'sets' | 'intensity'>>) {
    setExercises((current) => current.map((exercise) => exercise.id === id ? { ...exercise, ...patch } : exercise));
  }

  function addExercise() {
    const sortOrder = exercises.filter((exercise) => exercise.body_part === bodyPart).length;
    setExercises((current) => [...current, {
      id: `draft-${crypto.randomUUID()}`,
      body_part: bodyPart,
      exercise_name: '',
      repetitions: '10',
      sets: '3',
      intensity: 'normal',
      sort_order: sortOrder,
      isDraft: true,
    }]);
    setError('');
  }

  function adjustCount(exercise: ExerciseCard, field: 'repetitions' | 'sets', amount: number) {
    const current = Number(exercise[field]);
    const max = field === 'repetitions' ? 99 : 9;
    const next = Math.max(1, Math.min(max, current + amount));
    if (next === current) return;
    const value = String(next).padStart(field === 'repetitions' ? 2 : 1, '0');
    const updated = { ...exercise, [field]: value };
    updateExercise(exercise.id, { [field]: value });
    void saveExercise(updated);
  }

  async function saveExercise(exercise: ExerciseCard) {
    if (savingIds.has(exercise.id)) return;
    const exerciseName = exercise.exercise_name.trim();
    const repetitions = Number(exercise.repetitions);
    const sets = Number(exercise.sets);
    if (!exerciseName && exercise.isDraft) return;
    if (!exerciseName || !Number.isInteger(repetitions) || repetitions < 1 || repetitions > 99 || !Number.isInteger(sets) || sets < 1 || sets > 9) {
      setError('운동 이름, 1~99회 반복, 1~9세트를 입력해주세요.');
      return;
    }

    const bodyItems = exercises.filter((item) => item.body_part === exercise.body_part);
    const rowIndex = bodyItems.findIndex((item) => item.id === exercise.id);
    const sortOrder = bodyItems.slice(0, rowIndex).filter((item) => !item.isDraft).length;
    setSavingIds((current) => new Set(current).add(exercise.id));
    setError('');
    try {
      const response = await fetch('/api/health-routine', {
        method: exercise.isDraft ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: exercise.isDraft ? undefined : exercise.id,
          bodyPart: exercise.body_part,
          exerciseName,
          repetitions,
          sets,
          intensity: exercise.intensity,
          sortOrder: exercise.isDraft ? sortOrder : exercise.sort_order,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '운동 정보를 저장하지 못했습니다.');
      const saved = toCard(data.exercise as HealthExercise);
      const nextExercises = exercises.map((item) => item.id === exercise.id ? saved : item);
      setExercises((current) => current.map((item) => item.id === exercise.id ? saved : item));

      if (exercise.isDraft) {
        const orderedIds = nextExercises
          .filter((item) => item.body_part === exercise.body_part && !item.isDraft)
          .map((item) => item.id);
        await persistOrder(orderedIds);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '운동 정보를 저장하지 못했습니다.');
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(exercise.id);
        return next;
      });
    }
  }

  async function persistOrder(ids: string[]) {
    const response = await fetch('/api/health-routine', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reorder', ids }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '운동 순서를 저장하지 못했습니다.');
  }

  async function deleteExercise(exercise: ExerciseCard) {
    if (!window.confirm(`“${exercise.exercise_name || '이 운동'}”을 삭제할까요?`)) return;
    if (exercise.isDraft) {
      setExercises((current) => current.filter((item) => item.id !== exercise.id));
      return;
    }
    setDeletingIds((current) => new Set(current).add(exercise.id));
    setError('');
    try {
      const response = await fetch(`/api/health-routine?id=${encodeURIComponent(exercise.id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '운동을 삭제하지 못했습니다.');
      let sortOrder = 0;
      const next = exercises.filter((item) => item.id !== exercise.id).map((item) => {
        if (item.body_part !== exercise.body_part || item.isDraft) return item;
        return { ...item, sort_order: sortOrder++ };
      });
      setExercises(next);
      await persistOrder(next.filter((item) => item.body_part === exercise.body_part && !item.isDraft).map((item) => item.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '운동을 삭제하지 못했습니다.');
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(exercise.id);
        return next;
      });
    }
  }

  function startReorder(exercise: ExerciseCard, event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const handle = event.currentTarget;
    try { handle.setPointerCapture(event.pointerId); } catch {}
    const timer = window.setTimeout(() => {
      if (reorderPress.current) reorderPress.current.active = true;
      setDraggingId(exercise.id);
      setDragOffsetY(0);
    }, 380);
    reorderPress.current = { id: exercise.id, startY: event.clientY, pointerId: event.pointerId, active: false, timer };
  }

  function moveReorder(event: PointerEvent<HTMLButtonElement>) {
    const press = reorderPress.current;
    if (!press || press.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - press.startY;
    if (!press.active && Math.abs(deltaY) > 10) {
      window.clearTimeout(press.timer);
      reorderPress.current = null;
      return;
    }
    if (press.active) {
      event.preventDefault();
      setDragOffsetY(deltaY);
    }
  }

  async function finishReorder(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const press = reorderPress.current;
    reorderPress.current = null;
    if (!press) return;
    window.clearTimeout(press.timer);
    if (!press.active) return;

    const moving = visibleExercises.find((item) => item.id === press.id);
    const list = listRef.current;
    if (!cancelled && moving && list) {
      const others = visibleExercises.filter((item) => item.id !== moving.id);
      const cards = Array.from(list.querySelectorAll<HTMLElement>('[data-health-exercise-id]'))
        .filter((card) => card.dataset.healthExerciseId !== moving.id)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      let targetIndex = cards.findIndex((card) => event.clientY < card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2);
      if (targetIndex < 0) targetIndex = others.length;
      const reordered = [...others];
      reordered.splice(targetIndex, 0, moving);
      let sortOrder = 0;
      const ordered = reordered.map((item) => item.isDraft ? item : { ...item, sort_order: sortOrder++ });

      let orderedIndex = 0;
      const next = exercises.map((item) => item.body_part === bodyPart ? ordered[orderedIndex++] : item);
      setExercises(next);
      setDraggingId(null);
      setDragOffsetY(0);
      try {
        await persistOrder(ordered.filter((item) => !item.isDraft).map((item) => item.id));
      } catch (reorderError) {
        setError(reorderError instanceof Error ? reorderError.message : '운동 순서를 저장하지 못했습니다.');
      }
    }
    setDraggingId(null);
    setDragOffsetY(0);
  }

  if (loading || authenticated === null) return <main className="loading-screen"><LoadingDots /></main>;
  if (!authenticated) return <main className="app"><section className="container"><div className="feature-placeholder"><h2>접근할 수 없습니다.</h2><p>먼저 Passcode를 입력해주세요.</p><Link href="/" className="back-link">처음으로</Link></div></section></main>;

  return (
    <main className="app">
      <section className="container stock-container routine-container health-routine-container">
        <header className="header">
          <div><p className="eyebrow brand-eyebrow">Master 3.0</p><h1>헬스루틴</h1></div>
          <div className="routine-header-actions">
            <Link href="/" className="logout-button">처음으로</Link>
          </div>
        </header>

        <div className="routine-day-switch health-routine-tabs" role="tablist" aria-label="운동 부위 선택">
          {BODY_PARTS.map((part) => (
            <button key={part.id} type="button" role="tab" aria-selected={bodyPart === part.id} className={bodyPart === part.id ? 'is-selected' : ''} onClick={() => setBodyPart(part.id)}>
              {part.label}
            </button>
          ))}
        </div>

        {error && <p className="routine-error health-routine-error" role="alert">{error}</p>}
        <div ref={listRef} className="health-routine-list" aria-label={`${bodyPart === 'upper' ? '상체' : '하체'} 운동 목록`}>
          {visibleExercises.map((exercise) => (
            <article
              key={exercise.id}
              data-health-exercise-id={exercise.id}
              data-health-exercise-draft={exercise.isDraft ? 'true' : 'false'}
              className={`health-exercise-card${draggingId === exercise.id ? ' is-dragging' : ''}`}
              style={draggingId === exercise.id ? { '--exercise-drag-offset': `${dragOffsetY}px` } as CSSProperties : undefined}
            >
              <button
                type="button"
                className="health-exercise-grip"
                aria-label="길게 눌러 운동 순서 변경"
                title="길게 눌러 순서 변경"
                disabled={Boolean(savingIds.has(exercise.id) || deletingIds.has(exercise.id))}
                onContextMenu={(event) => event.preventDefault()}
                onPointerDown={(event) => startReorder(exercise, event)}
                onPointerMove={moveReorder}
                onPointerUp={(event) => void finishReorder(event)}
                onPointerCancel={(event) => void finishReorder(event, true)}
              >
                <svg viewBox="0 0 16 20" aria-hidden="true"><circle cx="5" cy="4" r="1.3" /><circle cx="11" cy="4" r="1.3" /><circle cx="5" cy="10" r="1.3" /><circle cx="11" cy="10" r="1.3" /><circle cx="5" cy="16" r="1.3" /><circle cx="11" cy="16" r="1.3" /></svg>
              </button>
              <input
                className="health-exercise-name"
                aria-label="운동 종목"
                autoFocus={Boolean(exercise.isDraft)}
                disabled={savingIds.has(exercise.id) || deletingIds.has(exercise.id)}
                maxLength={80}
                placeholder="운동 종목"
                value={exercise.exercise_name}
                onChange={(event) => updateExercise(exercise.id, { exercise_name: event.target.value })}
                onBlur={() => void saveExercise(exercise)}
              />
              <div className="health-exercise-stepper health-exercise-reps" role="group" aria-label="반복 횟수">
                <button type="button" aria-label="반복 횟수 줄이기" disabled={savingIds.has(exercise.id) || deletingIds.has(exercise.id) || Number(exercise.repetitions) <= 1} onClick={() => adjustCount(exercise, 'repetitions', -1)}>−</button>
                <output>{exercise.repetitions.padStart(2, '0')}</output>
                <button type="button" aria-label="반복 횟수 늘리기" disabled={savingIds.has(exercise.id) || deletingIds.has(exercise.id) || Number(exercise.repetitions) >= 99} onClick={() => adjustCount(exercise, 'repetitions', 1)}>+</button>
              </div>
              <span className="health-exercise-unit">회 ×</span>
              <div className="health-exercise-stepper health-exercise-sets" role="group" aria-label="세트 수">
                <button type="button" aria-label="세트 수 줄이기" disabled={savingIds.has(exercise.id) || deletingIds.has(exercise.id) || Number(exercise.sets) <= 1} onClick={() => adjustCount(exercise, 'sets', -1)}>−</button>
                <output>{exercise.sets}</output>
                <button type="button" aria-label="세트 수 늘리기" disabled={savingIds.has(exercise.id) || deletingIds.has(exercise.id) || Number(exercise.sets) >= 9} onClick={() => adjustCount(exercise, 'sets', 1)}>+</button>
              </div>
              <span className="health-exercise-unit">세트</span>
              <select
                className={`health-exercise-intensity is-${exercise.intensity}`}
                aria-label="운동 강도"
                disabled={savingIds.has(exercise.id) || deletingIds.has(exercise.id)}
                value={exercise.intensity}
                onChange={(event) => updateExercise(exercise.id, { intensity: event.target.value as Intensity })}
                onBlur={() => void saveExercise(exercise)}
              >
                {INTENSITIES.map((intensity) => <option value={intensity.id} key={intensity.id}>{intensity.label}</option>)}
              </select>
              <button type="button" className="health-exercise-delete" aria-label={`${exercise.exercise_name || '운동'} 삭제`} title="삭제" disabled={savingIds.has(exercise.id) || deletingIds.has(exercise.id)} onClick={() => void deleteExercise(exercise)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M9 7V4.5h6V7m-8.5 0 1 12.5h9L17.5 7M10 10.5v5.5m4-5.5v5.5" /></svg>
              </button>
            </article>
          ))}
          {visibleExercises.length === 0 && <div className="health-routine-empty"><p>{bodyPart === 'upper' ? '상체' : '하체'} 운동을 추가해 루틴을 만들어보세요.</p></div>}
          <button type="button" className="routine-add-button health-routine-list-add" onClick={addExercise} aria-label={`${bodyPart === 'upper' ? '상체' : '하체'} 운동 추가`} title="운동 추가">+</button>
        </div>
      </section>
    </main>
  );
}
