import { atomsForStage } from './curriculum'
import { emptyProgress, recordAttempt, type Progress } from './progress'
import {
  BLOCK_SECONDS,
  EXTRA_NEW_ATOMS,
  NEW_ATOMS_PER_DAY,
  selectSession,
  SESSION_SECONDS,
} from './session'

const NOW = 1_700_000_000_000

describe('selectSession', () => {
  it('always runs the four blocks in order', () => {
    const plan = selectSession(emptyProgress(), NOW)
    expect(plan.blocks.map((b) => b.kind)).toEqual(['warmup', 'focus', 'faderep', 'close'])
  })

  it('always totals exactly the session budget', () => {
    expect(selectSession(emptyProgress(), NOW).totalSeconds).toBe(SESSION_SECONDS)
  })

  it('sums the block seconds to the total', () => {
    const plan = selectSession(emptyProgress(), NOW)
    const sum = plan.blocks.reduce((acc, b) => acc + b.seconds, 0)
    expect(sum).toBe(SESSION_SECONDS)
    expect(sum).toBe(
      BLOCK_SECONDS.warmup + BLOCK_SECONDS.focus + BLOCK_SECONDS.faderep + BLOCK_SECONDS.close,
    )
  })

  it('introduces at most two new atoms for a brand-new learner', () => {
    const plan = selectSession(emptyProgress(), NOW)
    const focus = plan.blocks.find((b) => b.kind === 'focus')
    expect(focus?.items.length).toBe(NEW_ATOMS_PER_DAY)
  })

  it('only offers atoms from an unlocked stage', () => {
    const plan = selectSession(emptyProgress(), NOW)
    const allowed = new Set(atomsForStage(1).map((a) => a.id))
    for (const block of plan.blocks) {
      for (const item of block.items) expect(allowed.has(item.atomId)).toBe(true)
    }
  })

  it('gives a new learner nothing to warm up on', () => {
    const plan = selectSession(emptyProgress(), NOW)
    expect(plan.blocks.find((b) => b.kind === 'warmup')?.items).toEqual([])
  })

  it('presents fade-rep atoms one level above their record', () => {
    let progress: Progress = emptyProgress()
    const atomId = atomsForStage(1)[0]?.id ?? '0+1'
    // Four fast correct answers reach box 5 with a full latency window, making
    // the atom reflex — while staying one short of the five-answer fade promotion.
    for (let i = 0; i < 4; i++) progress = recordAttempt(progress, atomId, true, 400, NOW)
    const record = progress.atoms[atomId]
    expect(record).toBeDefined()
    const plan = selectSession(progress, NOW + 60_000)
    const found = plan.blocks.find((b) => b.kind === 'faderep')?.items.find((i) => i.atomId === atomId)
    expect(found).toBeDefined()
    expect(found?.fade).toBe((record?.fade ?? 0) + 1)
  })

  it('keeps atoms that are not yet fluent out of the fade-rep block', () => {
    let progress: Progress = emptyProgress()
    const atomId = atomsForStage(1)[0]?.id ?? '0+1'
    progress = recordAttempt(progress, atomId, true, 400, NOW)
    const plan = selectSession(progress, NOW + 60_000)
    const faderep = plan.blocks.find((b) => b.kind === 'faderep')
    expect(faderep?.items.map((i) => i.atomId)).not.toContain(atomId)
  })

  it('never shows the same atom twice within one block', () => {
    const plan = selectSession(emptyProgress(), NOW)
    for (const block of plan.blocks) {
      const ids = block.items.map((i) => i.atomId)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  describe('reserve', () => {
    // The stage-1 curriculum order, as atomsForStage produces it: the atoms
    // classified 'direct'. A fresh learner's fresh two (0+1, 0+2) come off the
    // front of this same list, so the reserve is whatever comes right after.
    const stage1Order = atomsForStage(1).map((a) => a.id)

    it('gives a fresh learner the next up-to-four unseen atoms, at fade 0 with demo coaching', () => {
      const plan = selectSession(emptyProgress(), NOW)
      const expectedIds = stage1Order.slice(NEW_ATOMS_PER_DAY, NEW_ATOMS_PER_DAY + EXTRA_NEW_ATOMS)
      expect(plan.reserve?.map((i) => i.atomId)).toEqual(expectedIds)
      for (const reserveItem of plan.reserve ?? []) {
        expect(reserveItem.fade).toBe(0)
        expect(reserveItem.coaching).toBe('demo')
      }
    })

    it('never contains a fresh (focus) atom', () => {
      const plan = selectSession(emptyProgress(), NOW)
      const focusIds = new Set(plan.blocks.find((b) => b.kind === 'focus')?.items.map((i) => i.atomId))
      for (const reserveItem of plan.reserve ?? []) {
        expect(focusIds.has(reserveItem.atomId)).toBe(false)
      }
    })

    it('is shorter when fewer unseen atoms remain', () => {
      // Mark every stage-1 atom but the last three as seen, without making
      // any of them fluent (so stage 2 stays locked and the available pool
      // does not change shape out from under the slice below).
      let progress: Progress = emptyProgress()
      const toMark = stage1Order.slice(0, stage1Order.length - 3)
      for (const atomId of toMark) {
        progress = recordAttempt(progress, atomId, true, null, NOW)
      }

      const plan = selectSession(progress, NOW)
      const remainingUnseen = stage1Order.slice(stage1Order.length - 3)
      // The first two of the three remaining unseen atoms are today's fresh
      // ones, and land in the focus block; only the last one is left over
      // for the reserve.
      const focusIds = plan.blocks.find((b) => b.kind === 'focus')?.items.map((i) => i.atomId) ?? []
      for (const freshId of remainingUnseen.slice(0, NEW_ATOMS_PER_DAY)) {
        expect(focusIds).toContain(freshId)
      }
      expect(plan.reserve?.map((i) => i.atomId)).toEqual(remainingUnseen.slice(NEW_ATOMS_PER_DAY))
      expect(plan.reserve).toHaveLength(1)
    })
  })
})
