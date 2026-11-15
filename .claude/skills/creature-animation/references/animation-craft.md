# Animation craft for creatures

What separates "bones wiggling" from a creature that feels alive. Read the sections that
apply to the anatomy and the clip you are making.

## Contents
1. Principles that matter most in game clips
2. Timing by mass
3. Legged locomotion (gait table)
4. Wings
5. Serpents, tails, tentacles
6. Attacks, hits, deaths
7. Idles and personality
8. A sensible clip set for a game enemy

## 1. Principles that matter most

- **The hips lead, everything else follows.** Start any action from `P.body(...)`; the chest
  arrives a few frames later, the head and tail later still. In code: phase-lag (`osc(t, 1,
  -0.08 * i)`) or shifted `pulse()` windows down the chain.
- **Anticipation → action → overshoot → settle.** A strike is 30-40% wind-up (slow, opposite
  direction), 10-15% strike (fast - only 2-4 frames), then overshoot and a slow settle.
  Without the wind-up the player cannot read the attack; without the settle it looks cut off.
- **Arcs and overlap.** Loose parts (tail, ears, wing tips, tentacles) drag behind and keep
  going after the body stops. `P.wave(..., lag=0.12-0.18)` gives that for free.
- **Counter-motion.** Hips twist one way, shoulders the other; head counter-rotates to stay
  level; tail swings opposite to the head on turns. It is what keeps balance believable.
- **Asymmetry.** Never mirror both sides perfectly in an idle or roar; offset one side's
  phase by 0.05-0.15 or scale it by 0.8.
- **Weight shows in the up/down of the hips** and in how long feet stay planted, not in how
  far limbs swing.

## 2. Timing by mass (30 fps)

| creature | walk cycle | run cycle | idle breath | attack total | hit | death |
|---|---|---|---|---|---|---|
| tiny (imp, rat, spider <0.5 m) | 0.4-0.6 s | 0.25-0.35 s | 1.5-2 s | 0.5-0.7 s | 0.3 s | 0.8-1.2 s |
| human-size | 0.9-1.1 s | 0.5-0.65 s | 3-4 s | 0.8-1.2 s | 0.4-0.5 s | 1.5-2 s |
| large (ogre, horse, wyvern) | 1.2-1.6 s | 0.6-0.8 s | 4-5 s | 1.2-1.8 s | 0.6 s | 2-3 s |
| huge (dragon, giant) | 1.8-2.6 s | 0.9-1.2 s | 5-7 s | 1.8-3 s | 0.8 s | 3-5 s |

Bigger = slower, longer holds, more follow-through, smaller relative hip bob but a visible
"settle" when each foot lands. Small = quick, twitchy, holds between bursts. Pass durations
with `rig.add_standard_clips(None, walk={"duration": 2.0}, ...)` or in your own `rig.clip`.

## 3. Legged locomotion

`P.gait(stride, lift, duty)`; phases come from `ca.set_gait(rig, name)`.

| gait | who | duty | notes |
|---|---|---|---|
| `alternate` | biped walk/run, quadruped **trot**, hexapod tripod, spider | walk .6-.65, run .35-.45 | diagonal pairs move together |
| `walk4` | quadruped walk | .65-.75 | LH, LF, RH, RF: always 2-3 feet down; spine sways side to side |
| `gallop` | quadruped run | .3-.4 | spine flexes up/down, one hip bob per cycle, airborne phase |
| `bound` | hop, pounce, frog, rabbit | .35-.5 | front pair then hind pair |
| `wave` | centipede, many-legged | .6-.7 | ripple travels back→front |

- stride ≈ 0.8-1.0 × leg length for a walk, 1.3-1.8 × for a run; lift ≈ 0.12-0.2 × leg
  length (walk), 0.25-0.35 × (run). Crawlers: short strides, high knees, almost no body bob.
- Hips: lowest just after a foot lands, highest mid-stance. Two bobs per cycle for bipeds and
  trots, one for a gallop.
- Sneak = long duty (.75), low hips (`P.body(up=-0.15*leg_len)`), slow. Limp = give one leg a
  shorter stance and dip the hips onto the good leg. Charge = run + body pitched forward, head
  low.
- Heavy creatures: add a small downward `pulse` on the hips right after each footfall.

## 4. Wings

- Downstroke is the power stroke: wing extended, fast (≈40% of the cycle). Upstroke: wing
  partly folded (`fwd` negative on outer bones), slower.
- Tips lag the shoulder (`osc(t, 1, -0.09 * i)`), giving the whip.
- Body rises during the downstroke and sinks on the upstroke - about a quarter cycle behind
  the wing angle. Tail and legs trail in counter-phase.
- Flap rate: sparrow-size 8+/s (just blur it), eagle 2-3/s, wyvern ~1.2/s, big dragon
  0.6-0.9/s. Hover = body pitched up 30-50°, bigger amplitude, faster.
- Glide = wings near flat with tiny tip flutter, slow body roll.
- Folded wings (ground clips): root up and back, outer bones folded in; let them "breathe".
- Takeoff/landing one-shots: crouch (anticipation) → legs extend + first big downstroke.

## 5. Serpents, tails, tentacles

- Slither: lateral wave travelling head→tail; amplitude grows toward the tail; the head
  stays aimed at the target (counter-rotate the first bone). 1-2 wavelengths along the body.
- Rearing cobra: front third of the spine `up` 20-30° per bone, rest coiled on the ground.
- Tails express mood: high and stiff = alert, slow wide sway = calm, fast lash = angry,
  tucked = hurt. In locomotion the tail counter-swings the hips.
- Tentacles: never all in phase - seed each with a different phase. Curl with a constant
  `bias` plus a travelling wave. A grab = straighten quickly (2-3 frames) then curl tip-first.
- Jet/pulse swimmers: slow spread (recovery), fast close (power), body surges just after.

## 6. Attacks, hits, deaths

- **Bite/lunge**: neck coils back + body shifts back and down (wind-up) → hips push forward,
  neck straightens, jaw opens just before contact and snaps shut at full extension → hold
  2-3 frames → recover. Front feet brace forward.
- **Claw/arm swipe**: torso twists away → swings through, hips and opposite foot step in →
  arm overshoots across the body → return.
- **Tail slam / wing buffet**: start the turn from the hips, let it travel out to the tip.
- Mark the contact moment (e.g. t=0.5) in your report; games fire damage on that frame.
- **Hit reaction**: maximum displacement by frame 2-3, away from the blow, then a slow
  return. Short (0.3-0.6 s) so it can interrupt anything.
- **Death**: react → lose support (legs buckle one after another, not together) → body drops
  with a small bounce → extremities (head, tail, wing tips) land last and settle. Use
  `keep_above_ground=True`. The final pose is held forever, so make it read clearly.
  Bipeds topple forward or back; quadrupeds collapse onto belly or side; flyers fold up;
  spiders curl their legs inward.

## 7. Idles and personality

- Base: slow breathing in the chest (and wings), weight shift in the hips.
- Layer: a look-around, a tail flick, a wing rustle - at different, non-synchronised rates
  (use different integer `cycles` on a long 4-8 s loop).
- Personality by posture offset held through every clip: aggressive = head low, shoulders
  forward; proud = chest out, head high; nervous = fast small motions, head darting; undead
  = asymmetry, head tilted, delayed limbs.

## 8. A sensible clip set for a game enemy

`idle`, `walk`, `run`, `attack` (1-3 variants: `attack_bite`, `attack_claw`, `attack_tail`),
`hit`, `death`, plus `roar`/`taunt` for bosses; flyers add `fly`, `hover`, `glide`,
`takeoff`, `land`. Loops: idle/walk/run/fly/hover/glide. Everything else plays once and
starts from the idle pose so the engine can cross-fade in 0.1-0.2 s.
