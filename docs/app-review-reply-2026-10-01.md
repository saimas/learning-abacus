# App Review reply — Guideline 2.1 "Information Needed" (1.0, 2026-10-01)

The reply and review notes sent for 1.0's first rejection.
Submission `e45b5fd4-7b00-4ad4-8266-34e15eae267c`, version 1.0 with build 32
(1.0.0), app `com.saimas.learningabacus` (Apple ID 6814269098). Apple's
message arrived 2026-10-01 14:01 JST: "Guideline 2.1 - Information Needed -
New App Submission", sent because the account "has a limited App Review
history". It asks for a reply covering six items, and for the same
information in App Review Information → Notes. It is the request
learning-vocabulary got for its 1.0 (its `docs/app-review-reply-2026-08-27.md`),
which was approved two days after the reply.

No new build: build 32 stays attached. Steps, in order:

1. Demo video — DONE 2026-10-01. Recorded over USB with QuickTime
   (learning-vocabulary's `record-iphone` skill) on the owner's iPhone SE
   (2nd generation, `iPhone12,8`, iOS 26.7) running the TestFlight build 32.
   Attach `~/Desktop/abacus-demo-iphoneSE-2026-10-01-cut.mov` (85.5 s,
   H.264 750×1334@60, 4.3 MB, no audio). It joins take 3's launch (127–132.5 s:
   Home Screen → tap on the icon → launch screen → Home) to take 2's flow
   (294.5–374.5 s), both on the app's Home in the same state, so the join
   doesn't show. Take 2 began inside the app, and take 1 is missing the
   correction and the lesson and starts with the lock screen. The raw takes
   stay on the Desktop, not in the repo.
2. **App Review Information → Notes**: set to §B (via the API,
   `PATCH /v1/appStoreReviewDetails/f2653667-35c0-456b-b80e-440f0d299e73`).
   DONE 2026-10-01; the read-back matches §B (1955 characters).
3. **Resolution Center** → Reply to App Review: paste §A, attach the cut
   video, press **Reply**. Claude filled the composer in Chrome and saved
   it as a draft; the owner checked it and sent it 2026-10-01 17:45 JST.
4. Version page → **Update Review**. That is the control that resolves the
   rejected item; "Resubmit to App Review" on the submission page stays
   disabled until it is pressed. Unlike learning-vocabulary's resubmission,
   that alone left the submission `UNRESOLVED_ISSUES` (item and version
   `READY_FOR_REVIEW`). **Resubmit to App Review** then had to be pressed
   too.

**RESUBMITTED 2026-10-01 17:47 JST.** The owner pressed Reply, Update Review
and Resubmit. Verified via the API: submission `e45b5fd4` and version 1.0
`WAITING_FOR_REVIEW`, build 32, releaseType `AFTER_APPROVAL` (goes live by
itself once approved).

---

## A. Resolution Center reply

Apple's composer takes plain text and at most 4000 characters, so this is
the exact text sent (3890 characters). The longer first draft didn't fit, and
its detail lives in the review notes (§B).

```text
Hello, and thank you for the review.

The requested information is below, and the screen recording is attached.

1. Screen recording (physical device)
Attached: abacus-demo-iphoneSE-2026-10-01-cut.mov, recorded on an iPhone SE (2nd generation) running iOS 26.7 with build 32 (1.0.0), the submitted build, installed through TestFlight. It begins with launching the app from the Home Screen, then shows: a practice round of 2-digit addition (answers set by tapping beads, then こたえる / Answer; at this level the beads are faded on purpose, see item 3) with a correct answer (〇) and a wrong one (✕), whose step-by-step correction opens with こたえを見る / See answer; leaving the round; a やりかた / How it works lesson and its practice problem; the Progress screen; and Settings, switching the UI to English and back. It joins two recordings made minutes apart on that iPhone and build (the launch, then the flow), with pauses removed.
The app has no account registration, login or account deletion, no user-generated content, and no paid content, purchases or subscriptions. The one-time tutorial on first launch (reading the number on each rod) is described in item 3.
Tested on: iPhone SE (2nd generation), iOS 26.7 (physical device, TestFlight); iPhone 17 Pro and iPhone SE (3rd generation) simulators, iOS 26.1.

2. Purpose and target audience
The app teaches soroban (Japanese abacus) arithmetic, and mental calculation with an imagined soroban (anzan), from no prior knowledge in short daily practice. It is for children and adults, mainly Japanese speakers; the UI is also available in English. Age rating 4+.
Soroban is usually learned in a classroom, with a teacher correcting each bead move. The app gives that correction on every problem: answers are entered by moving beads on an on-screen soroban, a wrong answer is followed by a step-by-step replay of the correct bead moves, and each technique (5 and 10 complements, multiplication, division, adding a column of numbers) has a worked lesson. As the learner keeps answering correctly, the beads fade until they are invisible, moving the learner from the tool to mental calculation.

3. Setup and access instructions
No account, sign-in, purchase or network connection is needed. The UI is Japanese by default; switch to English in Settings (gear icon, top right of Home) → 言語 / Language → English. First launch shows a short tutorial: enter the number on each of ten rods and press たしかめる / Check. Home then shows:
- the practice grid (けたの練習 / Bigger numbers): rows ＋ − × ÷ ± (a column of five numbers), columns 1-, 2- and 3-digit. Tap a cell for a round of ten problems; set each answer with the beads and press こたえる / Answer. 手順を見る / Show the steps shows the solution at any time; ✕ leaves the round.
- four やりかた / How it works tiles (＋ − × ÷) with worked lessons, each ending with one practice problem.
- Progress (grid icon, top right).
Each cell has a level (0–6): five right answers in a row move it up one, two misses in a row down one. From level 3 the beads fade on purpose (dimmed, outline, frame only, then nothing) so the learner works from memory; they can still be tapped where they would be. Settings → すべての進捗を消す / Reset all progress returns everything to level 0 and brings the tutorial back.

4. External services
None. The app is fully offline: no network requests, no analytics or advertising SDKs, no authentication, payment or AI services. Progress stays on the device; all problems and lessons are generated on it.

5. Regional differences
None. The app works the same in every region; the only option is the UI language (Japanese or English).

6. Regulated industry / protected material
Not applicable: an education app outside regulated industries; all content is original, with no third-party licensed or copyrighted material.

Please let me know if anything else would help the review.

Best regards,
Masashi Saito
```

---

## B. App Review Information → Notes (kept for future submissions)

Replaces the notes sent with the first submission, which wrongly said the UI
follows the device language: it is Japanese by default and switches only in
Settings (`DEFAULT_LOCALE = 'ja'` in `src/i18n/locale.ts`).

> No sign-in, account, purchase, advertising or network connection is needed: the app is fully offline and stores all data on the device.
>
> Purpose and audience: soroban (Japanese abacus) arithmetic and mental calculation, taught from zero in short daily practice, for children and adults (mainly Japanese speakers). The UI is Japanese by default; switch to English in Settings (gear icon, top right of Home) → 言語 / Language → English.
>
> How to use: first launch shows a short tutorial (enter the number on each of ten rods, press たしかめる / Check), then Home. Tap a cell in the けたの練習 / Bigger numbers grid (rows ＋ − × ÷ ±, columns 1-, 2- and 3-digit) to start a round of 10 problems: set the answer by tapping beads on the on-screen soroban and press こたえる / Answer. A right answer is stamped 〇; a miss shows ✕, and こたえを見る / See answer opens the step-by-step correction (at levels 0–1 it opens by itself). 手順を見る / Show the steps shows the same steps before answering. The four やりかた / How it works tiles on Home open worked lessons for each operation, each ending with one practice problem.
>
> Levels: each grid cell shows its level (0–6; 「レベル 3/6」 in a round's top bar). Five right answers in a row move it up one level and two misses move it down one, at most one level per round. From level 3 the beads fade on purpose so the learner works from memory: dimmed, then a faint outline, then the frame only, then nothing. The beads still move and can still be tapped where they would be, and the answer is read from them. Settings → すべての進捗を消す / Reset all progress returns every cell to level 0.
>
> External services: none. Regional differences: none. No third-party content, no user-generated content, no data collection.
>
> Tested on: iPhone SE (2nd generation) with iOS 26.7 (physical device, TestFlight), and iPhone 17 Pro and iPhone SE (3rd generation) simulators with iOS 26.1. A physical-device screen recording was provided in the Resolution Center on 2026-10-01.
