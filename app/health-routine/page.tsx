'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import Link from 'next/link';
import LoadingDots from '../../components/LoadingDots';

type BodyPart = 'upper' | 'lower';
type HealthExercise = {
  id: string;
  body_part: BodyPart;
  exercise_name: string;
  repetitions: number;
  sets: number;
  intensity: 'easy' | 'normal' | 'hard';
  weight_kg: number | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};
type ExerciseCard = Omit<HealthExercise, 'repetitions' | 'sets' | 'weight_kg'> & {
  repetitions: string;
  sets: string;
  weight_kg: string;
  isDraft?: boolean;
};
type CountField = 'weight_kg' | 'repetitions' | 'sets';
type ReorderPress = {
  id: string;
  startX: number;
  startY: number;
  startScrollY: number;
  lastY: number;
  grabOffsetY: number;
  originalIndex: number;
  originalOrder: string[];
  slotStride: number;
  pointerId: number;
  active: boolean;
  scrolling: boolean;
  timer: number;
};

const BODY_PARTS: { id: BodyPart; label: string }[] = [
  { id: 'upper', label: '상체' },
  { id: 'lower', label: '하체' },
];
function toCard(exercise: HealthExercise): ExerciseCard {
  return {
    ...exercise,
    repetitions: String(exercise.repetitions).padStart(2, '0'),
    sets: String(exercise.sets),
    weight_kg: exercise.weight_kg == null ? '' : String(exercise.weight_kg),
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
  const [countDialog, setCountDialog] = useState<{ exerciseId: string; field: CountField; value: number } | null>(null);

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

  function updateExercise(id: string, patch: Partial<Pick<ExerciseCard, 'exercise_name' | 'repetitions' | 'sets' | 'intensity' | 'weight_kg'>>) {
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
      weight_kg: '',
      sort_order: sortOrder,
      isDraft: true,
    }]);
    setError('');
  }

  function openCountDialog(exercise: ExerciseCard, field: CountField) {
    if (savingIds.has(exercise.id) || deletingIds.has(exercise.id)) return;
    const value = field === 'weight_kg' ? Number(exercise.weight_kg || 0) : Number(exercise[field]);
    setCountDialog({ exerciseId: exercise.id, field, value });
  }

  function applyCountDialog() {
    if (!countDialog) return;
    const exercise = exercises.find((item) => item.id === countDialog.exerciseId);
    if (!exercise) return setCountDialog(null);
    const field = countDialog.field;
    if (field === 'weight_kg') {
      const weight = countDialog.value === 0 ? '' : countDialog.value.toFixed(1).replace(/\.0$/, '');
      const updated = { ...exercise, weight_kg: weight };
      updateExercise(exercise.id, { weight_kg: weight });
      setCountDialog(null);
      if (!exercise.isDraft) void saveExercise(updated);
      return;
    }
    const value = String(countDialog.value).padStart(field === 'repetitions' ? 2 : 1, '0');
    const updated = { ...exercise, [field]: value };
    updateExercise(exercise.id, { [field]: value });
    setCountDialog(null);
    if (!exercise.isDraft) void saveExercise(updated);
  }

  async function saveExercise(exercise: ExerciseCard) {
    if (savingIds.has(exercise.id)) return;
    const exerciseName = exercise.exercise_name.trim();
    const repetitions = Number(exercise.repetitions);
    const sets = Number(exercise.sets);
    const weightKg = exercise.weight_kg.trim() === '' ? null : Number(exercise.weight_kg);
    if (!exerciseName && exercise.isDraft) return;
    if (!exerciseName || !Number.isInteger(repetitions) || repetitions < 1 || repetitions > 99 || !Number.isInteger(sets) || sets < 1 || sets > 9 || (weightKg !== null && (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 999.99))) {
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
          weightKg,
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

  function startReorder(exercise: ExerciseCard, index: number, event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (reorderPress.current) window.clearTimeout(reorderPress.current.timer);
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const list = listRef.current;
    const rowGap = list ? Number.parseFloat(window.getComputedStyle(list).rowGap) || 0 : 0;
    const pointerId = event.pointerId;
    const timer = window.setTimeout(() => {
      const press = reorderPress.current;
      if (!press || press.id !== exercise.id || press.pointerId !== pointerId || press.scrolling) return;
      press.active = true;
      try { card.setPointerCapture(pointerId); } catch {}
      setDraggingId(exercise.id);
      setDragOffsetY(0);
    }, 380);
    reorderPress.current = {
      id: exercise.id,
      startX: event.clientX,
      startY: event.clientY,
      startScrollY: window.scrollY,
      lastY: event.clientY,
      grabOffsetY: event.clientY - rect.top,
      originalIndex: index,
      originalOrder: visibleExercises.map((item) => item.id),
      slotStride: rect.height + rowGap,
      pointerId,
      active: false,
      scrolling: false,
      timer,
    };
  }

  function moveReorder(event: PointerEvent<HTMLElement>) {
    const press = reorderPress.current;
    if (!press || press.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - press.startY;
    const deltaX = event.clientX - press.startX;

    if (!press.active && !press.scrolling && Math.abs(deltaX) > 14 && Math.abs(deltaY) < 14) {
      window.clearTimeout(press.timer);
      reorderPress.current = null;
      return;
    }

    if (!press.active && !press.scrolling && Math.abs(deltaY) > 10) {
      window.clearTimeout(press.timer);
      press.scrolling = true;
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
    }

    if (press.scrolling) {
      event.preventDefault();
      window.scrollBy(0, press.lastY - event.clientY);
      press.lastY = event.clientY;
      return;
    }

    if (press.active) {
      event.preventDefault();
      const list = listRef.current;
      const card = event.currentTarget;
      const others = visibleExercises.filter((item) => item.id !== press.id);
      const listTop = list?.getBoundingClientRect().top ?? 0;
      const otherCards = list
        ? Array.from(list.querySelectorAll<HTMLElement>('[data-health-exercise-id]')).filter((item) => item.dataset.healthExerciseId !== press.id)
        : [];
      const draggedCenter = event.clientY - press.grabOffsetY + card.getBoundingClientRect().height / 2 - listTop;
      const targetIndex = otherCards.findIndex((item) => draggedCenter < item.offsetTop + item.getBoundingClientRect().height / 2);
      const insertAt = targetIndex < 0 ? others.length : targetIndex;
      const currentIndex = visibleExercises.findIndex((item) => item.id === press.id);

      if (insertAt !== currentIndex) {
        const moving = visibleExercises.find((item) => item.id === press.id);
        if (moving) {
          const reordered = [...others];
          reordered.splice(insertAt, 0, moving);
          const previousTops = new Map<string, number>();
          if (list) {
            list.querySelectorAll<HTMLElement>('[data-health-exercise-id]').forEach((item) => {
              const id = item.dataset.healthExerciseId;
              item.getAnimations().forEach((animation) => animation.cancel());
              if (id && id !== press.id) previousTops.set(id, item.getBoundingClientRect().top);
            });
          }
          let orderedIndex = 0;
          const next = exercises.map((item) => item.body_part === bodyPart ? reordered[orderedIndex++] : item);
          setExercises(next);
          window.requestAnimationFrame(() => {
            if (!list) return;
            list.querySelectorAll<HTMLElement>('[data-health-exercise-id]').forEach((item) => {
              const id = item.dataset.healthExerciseId;
              const previousTop = id ? previousTops.get(id) : undefined;
              if (!id || id === press.id || previousTop === undefined) return;
              const distance = previousTop - item.getBoundingClientRect().top;
              if (Math.abs(distance) < 1) return;
              item.getAnimations().forEach((animation) => animation.cancel());
              item.animate(
                [{ transform: `translateY(${distance}px)` }, { transform: 'translateY(0)' }],
                { duration: 190, easing: 'cubic-bezier(0.22, 0.75, 0.25, 1)' },
              );
            });
          });
        }
      }

      const scrollDelta = window.scrollY - press.startScrollY;
      setDragOffsetY(deltaY + scrollDelta - (insertAt - press.originalIndex) * press.slotStride);
      if (event.clientY < 54) window.scrollBy(0, -12);
      else if (event.clientY > window.innerHeight - 54) window.scrollBy(0, 12);
    }
  }

  function stopPendingReorder() {
    const press = reorderPress.current;
    if (press && !press.active && !press.scrolling) {
      window.clearTimeout(press.timer);
      reorderPress.current = null;
    }
  }

  async function finishReorder(cancelled = false) {
    const press = reorderPress.current;
    reorderPress.current = null;
    if (!press) return;
    window.clearTimeout(press.timer);
    if (press.active) {
      const ordered = visibleExercises;
      if (cancelled) {
        const original = press.originalOrder.map((id) => ordered.find((item) => item.id === id)).filter((item): item is ExerciseCard => Boolean(item));
        setExercises((current) => {
          let orderedIndex = 0;
          return current.map((item) => item.body_part === bodyPart ? original[orderedIndex++] ?? item : item);
        });
      } else {
        let sortOrder = 0;
        const savedOrder = ordered.map((item) => item.isDraft ? item : { ...item, sort_order: sortOrder++ });
        setExercises((current) => {
          let orderedIndex = 0;
          return current.map((item) => item.body_part === bodyPart ? savedOrder[orderedIndex++] ?? item : item);
        });
        setDraggingId(null);
        setDragOffsetY(0);
        try {
          await persistOrder(savedOrder.filter((item) => !item.isDraft).map((item) => item.id));
        } catch (reorderError) {
          setError(reorderError instanceof Error ? reorderError.message : '운동 순서를 저장하지 못했습니다.');
        }
      }
      if (cancelled) {
        setDraggingId(null);
        setDragOffsetY(0);
      }
    }
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
          {visibleExercises.map((exercise, index) => (
            <article
              key={exercise.id}
              data-health-exercise-id={exercise.id}
              data-health-exercise-draft={exercise.isDraft ? 'true' : 'false'}
              className={`health-exercise-card${draggingId === exercise.id ? ' is-dragging' : ''}`}
              style={draggingId === exercise.id ? { '--exercise-drag-offset': `${dragOffsetY}px` } as CSSProperties : undefined}
              onPointerDown={(event) => startReorder(exercise, index, event)}
              onPointerMove={moveReorder}
              onPointerUp={() => void finishReorder()}
              onPointerCancel={() => void finishReorder(true)}
              onPointerLeave={stopPendingReorder}
              onContextMenu={(event) => event.preventDefault()}
              onDragStart={(event) => event.preventDefault()}
            >
              <span className="health-exercise-order" aria-label={`${index + 1}번째 운동`}>{index + 1}</span>
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
              <button type="button" className="health-exercise-count" aria-label={`무게 ${exercise.weight_kg || '0'}kg 변경`} onClick={() => openCountDialog(exercise, 'weight_kg')}>{exercise.weight_kg || '0'}</button>
              <span className="health-exercise-unit">kg</span>
              <button type="button" className="health-exercise-count" aria-label={`반복 횟수 ${exercise.repetitions}회 변경`} onClick={() => openCountDialog(exercise, 'repetitions')}>{exercise.repetitions.padStart(2, '0')}</button>
              <span className="health-exercise-unit">회 ×</span>
              <button type="button" className="health-exercise-count" aria-label={`세트 수 ${exercise.sets}세트 변경`} onClick={() => openCountDialog(exercise, 'sets')}>{exercise.sets}</button>
              <span className="health-exercise-unit">세트</span>
              <button type="button" className="health-exercise-delete" aria-label={`${exercise.exercise_name || '운동'} 삭제`} title="삭제" disabled={savingIds.has(exercise.id) || deletingIds.has(exercise.id)} onClick={() => void deleteExercise(exercise)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M9 7V4.5h6V7m-8.5 0 1 12.5h9L17.5 7M10 10.5v5.5m4-5.5v5.5" /></svg>
              </button>
            </article>
          ))}
          {visibleExercises.length === 0 && <div className="health-routine-empty"><p>{bodyPart === 'upper' ? '상체' : '하체'} 운동을 추가해 루틴을 만들어보세요.</p></div>}
          <button type="button" className="routine-add-button health-routine-list-add" onClick={addExercise} aria-label={`${bodyPart === 'upper' ? '상체' : '하체'} 운동 추가`} title="운동 추가">+</button>
        </div>
        {countDialog && <div className="modal-backdrop health-count-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCountDialog(null); }}>
          <section className="settings-modal health-count-modal" role="dialog" aria-modal="true" aria-labelledby="health-count-title">
            <div className="settings-modal-header"><h2 id="health-count-title">{countDialog.field === 'weight_kg' ? '무게 (kg)' : countDialog.field === 'repetitions' ? '반복 횟수' : '세트 수'}</h2><button type="button" className="modal-close" onClick={() => setCountDialog(null)}>닫기</button></div>
            <div className="health-count-controls">
              <button type="button" aria-label={countDialog.field === 'weight_kg' ? '1kg 줄이기' : '1 줄이기'} disabled={countDialog.value <= (countDialog.field === 'weight_kg' ? 0 : 1)} onClick={() => setCountDialog((current) => current ? { ...current, value: Math.max(current.field === 'weight_kg' ? 0 : 1, current.value - 1) } : current)}>−</button>
              <output>{countDialog.field === 'weight_kg' ? String(countDialog.value) : String(countDialog.value).padStart(countDialog.field === 'repetitions' ? 2 : 1, '0')}<span>{countDialog.field === 'weight_kg' ? 'kg' : countDialog.field === 'repetitions' ? '회' : '세트'}</span></output>
              <button type="button" aria-label={countDialog.field === 'weight_kg' ? '1kg 늘리기' : '1 늘리기'} disabled={countDialog.value >= (countDialog.field === 'weight_kg' ? 999 : countDialog.field === 'repetitions' ? 99 : 9)} onClick={() => setCountDialog((current) => current ? { ...current, value: Math.min(current.field === 'weight_kg' ? 999 : current.field === 'repetitions' ? 99 : 9, current.value + 1) } : current)}>+</button>
            </div>
            <button type="button" className="primary-button" onClick={applyCountDialog}>적용</button>
          </section>
        </div>}
      </section>
    </main>
  );
}
