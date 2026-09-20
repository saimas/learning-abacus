import { atomsForStage, type StageIndex } from './curriculum'
import { coachingForFade, MAX_FADE, type Coaching, type FadeLevel } from './fade'
import { currentStage, type Progress } from './progress'

export type BlockKind = 'warmup' | 'focus' | 'faderep' | 'close'
export type SessionItem = { atomId: string; fade: FadeLevel; coaching: Coaching }
export type SessionBlock = { kind: BlockKind; seconds: number; items: SessionItem[] }
export type SessionPlan = { blocks: SessionBlock[]; totalSeconds: number }

export const BLOCK_SECONDS: Record<BlockKind, number> = {
  warmup: 45,
  focus: 120,
  faderep: 90,
  close: 30,
}

export const SESSION_SECONDS = 285
export const NEW_ATOMS_PER_DAY = 2
export const MAX_ATTEMPTS_PER_ATOM = 3

const WARMUP_ITEMS = 10
const FOCUS_ITEMS = 3
const FADEREP_ITEMS = 6

function item(atomId: string, fade: FadeLevel): SessionItem {
  return { atomId, fade, coaching: coachingForFade(fade) }
}

export function selectSession(progress: Progress, now: number): SessionPlan {
  const stage: StageIndex = currentStage(progress)
  // Every unlocked stage stays in play, so earlier material keeps being rehearsed.
  const available = ([0, 1, 2, 3, 4] as const)
    .filter((index) => index <= stage)
    .flatMap((index) => atomsForStage(index))

  const seen = available.filter((atom) => progress.atoms[atom.id] !== undefined)
  const unseen = available.filter((atom) => progress.atoms[atom.id] === undefined)

  const due = seen
    .filter((atom) => (progress.atoms[atom.id]?.dueAt ?? 0) <= now)
    .sort((a, b) => (progress.atoms[b.id]?.box ?? 0) - (progress.atoms[a.id]?.box ?? 0))

  const warmup = due
    .slice(0, WARMUP_ITEMS)
    .map((atom) => item(atom.id, progress.atoms[atom.id]?.fade ?? 0))

  const shaky = seen
    .slice()
    .sort((a, b) => (progress.atoms[a.id]?.box ?? 0) - (progress.atoms[b.id]?.box ?? 0))
    .filter((atom) => !warmup.some((w) => w.atomId === atom.id))

  const fresh = unseen.slice(0, NEW_ATOMS_PER_DAY)
  const focusAtoms = [...fresh, ...shaky].slice(0, Math.max(FOCUS_ITEMS, fresh.length))
  const focus = focusAtoms.map((atom) => item(atom.id, progress.atoms[atom.id]?.fade ?? 0))

  const faderep = seen
    .filter((atom) => (progress.atoms[atom.id]?.fade ?? 0) < MAX_FADE)
    .slice(0, FADEREP_ITEMS)
    .map((atom) => item(atom.id, ((progress.atoms[atom.id]?.fade ?? 0) + 1) as FadeLevel))

  return {
    blocks: [
      { kind: 'warmup', seconds: BLOCK_SECONDS.warmup, items: warmup },
      { kind: 'focus', seconds: BLOCK_SECONDS.focus, items: focus },
      { kind: 'faderep', seconds: BLOCK_SECONDS.faderep, items: faderep },
      { kind: 'close', seconds: BLOCK_SECONDS.close, items: [] },
    ],
    totalSeconds: SESSION_SECONDS,
  }
}
