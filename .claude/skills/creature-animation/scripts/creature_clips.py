"""Stock clips for creature_anim. Each `make_*` returns (fn, kwargs-for-rig.clip).

These are starting points that already respect the animation principles in SKILL.md
(overlap down chains, counter-motion, weight in the hips). Read one before writing a
custom clip - copying a stock clip and changing it is the fastest route to a bespoke one.
"""
import math

from creature_anim import TAU, ease, gait_speed, osc, pulse, set_gait


def _anat(rig):
    """Shared handles + whether the body is upright (humanoid) or horizontal."""
    a = type("A", (), {})()
    a.spine = rig.spine
    neck = rig.by_role("neck")
    a.necks = [c.bones for c in neck]  # hydra-friendly: every neck chain
    a.heads = [c.bones[-1] for c in neck]
    a.tails = [c.bones for c in rig.by_role("tail")]
    a.wings = [c.bones for c in rig.by_role("wing")]
    a.arms = [c for c in rig.by_role("arm")]
    a.tentacles = [c.bones for c in rig.by_role("tentacle")]
    a.jaw = rig.tagged("jaw")
    a.upright = bool(a.spine) and abs(rig.bone_dir(a.spine[0]).dot(rig.up)) > .7
    a.L = rig.leg_len
    a.H = rig.height
    return a


def _arms_down(P, a, swing=0.0, bend=18):
    """Bring T-pose arms to the sides; swing>0 swings them opposite to the same-side leg."""
    for c in a.arms:
        b = c.bones
        up_arm = b[1] if len(b) >= 3 else b[0]  # skip the clavicle when there is one
        s = swing * osc(P.t, 1, .5 if c.side >= 0 else 0)  # left arm goes back while left leg leads
        P.rot(up_arm, up=-74, fwd=s)
        idx = b.index(up_arm)
        if len(b) > idx + 1:
            P.rot(b[idx + 1], fwd=bend + max(0, s) * .6)


def _secondary(P, a, amp=1.0, cycles=1):
    """Tails, tentacles and necks keep moving a little after the body - never leave them frozen."""
    for tl in a.tails:
        P.wave(tl, 5 * amp, cycles, lag=.14, toward="left")
        P.wave(tl, 2.5 * amp, cycles * 2, lag=.1, toward="up")
    for tn in a.tentacles:
        P.wave(tn, 7 * amp, cycles, lag=.13, toward="up", phase=hash(tn[0]) % 7 / 7)


def _fold_wings(P, a, amount=1.0, breathe=0.0):
    for w in a.wings:
        P.rot(w[0], up=18 * amount + breathe, fwd=-25 * amount)
        for b in w[1:]:
            P.rot(b, fwd=-38 * amount, up=-8 * amount)


def base_pose(P, rig, wings_folded=1.0):
    """The neutral standing pose every ground clip shares: T-pose arms brought down, wings
    folded. Call it first in a custom clip so the clip starts and ends where `idle` is and
    the engine can blend between them (skip it for flight clips, which want wings open)."""
    a = _anat(rig)
    _arms_down(P, a)
    _fold_wings(P, a, wings_folded)


def make_idle(rig, duration=3.0):
    a = _anat(rig)

    def fn(P, t):
        br = osc(t, 1)
        P.body(up=a.L * .012 * br, pitch=.6 * osc(t, 1, .1))
        if a.spine:
            P.rot(a.spine[-1], **({"fwd": -1.5 * br} if a.upright else {"up": 1.5 * br}))
        for nk in a.necks:
            ph = (hash(nk[0]) % 5) / 5 if len(a.necks) > 1 else 0
            for i, b in enumerate(nk):
                P.rot(b, up=1.2 * osc(t, 1, .2 - i * .08 + ph), left=1.5 * osc(t, 1, .5 + ph))
        _secondary(P, a, amp=1.0)
        _fold_wings(P, a, 1.0, breathe=2.5 * br)
        _arms_down(P, a)
        for i, l in enumerate(rig.legs):
            if not a.upright:
                continue
            P.foot(l, left=a.L * .02 * (1 if l.side >= 0 else -1))
    return fn, dict(duration=duration, loop=True)


def make_locomotion(rig, kind="walk", duration=None, stride=None):
    """walk / run for anything with legs; picks the gait from the leg count."""
    a = _anat(rig)
    n = len(rig.legs)
    run = kind == "run"
    if n == 4:
        gait = "gallop" if run else "walk4"
    elif n > 8:
        gait = "wave"
    else:
        gait = "alternate"
    crawler = n >= 6
    duty = (.4 if run else .65) if not crawler else (.5 if run else .6)
    stride = stride or a.L * ((1.5 if run else .95) if not crawler else (.8 if run else .55))
    duration = duration or ((.55 if run else 1.05) if not crawler else (.4 if run else .7))
    lift = a.L * ((.3 if run else .16) if not crawler else .22)
    bobs = 1 if (n == 4 and run) else 2  # two footfalls per cycle -> the body dips twice
    lean = (9 if run else 3) if a.upright else (3 if run else 0)

    def fn(P, t):
        set_gait(rig, gait)
        P.gait(stride, lift, duty)
        bob = a.L * (.05 if run else .022) * (.3 if crawler else 1)
        P.body(up=-bob * .6 + bob * osc(t, bobs, .15), left=a.L * .015 * osc(t, 1, .25) * (0 if crawler else 1),
               pitch=-lean + (4 * osc(t, 1, .3) if gait == "gallop" else 0), roll=1.5 * osc(t, 1) * (not crawler))
        tw = 6 if run else 4
        if a.upright and a.spine:  # shoulders counter-rotate against the hips
            P.rot(a.spine[0], twist=tw * osc(t, 1))
            P.rot(a.spine[-1], twist=-2 * tw * osc(t, 1))
        elif a.spine and not crawler:  # horizontal spine flexes side to side (and up/down in a gallop)
            for i, b in enumerate(a.spine):
                P.rot(b, left=2.5 * osc(t, 1, -i * .12))
                if gait == "gallop":
                    P.rot(b, up=2 * osc(t, 1, .1 - i * .08))
        for nk in a.necks:  # head stays steady: counter the body bob, slight nod
            for i, b in enumerate(nk):
                P.rot(b, up=(2.5 if run else 1.5) * osc(t, bobs, .4 - i * .1) + (lean * .5 if a.upright else 0))
        _arms_down(P, a, swing=38 if run else 22, bend=70 if run else 18)
        _secondary(P, a, amp=1.6 if run else 1.0, cycles=1)
        for tl in a.tails:  # tail trails lower at speed
            P.rot(tl[0], up=6 if run else 0)
        _fold_wings(P, a, 1.0, breathe=3 * osc(t, bobs))
    return fn, dict(duration=duration, loop=True, speed=gait_speed(stride, duration))


def make_slither(rig, duration=1.6, waves=1.5):
    """Legless travel: a wave runs head->tail along the spine (serpents, worms, eels)."""
    a = _anat(rig)
    body = a.spine + [b for tl in a.tails for b in tl]
    n = max(1, len(body))
    amp = min(28, 200 * waves / n)

    def fn(P, t):
        # counter-rotate the first bone so the head keeps pointing where the creature is going
        P.rot(body[0], left=-amp * .5 * osc(t, 1, 0))
        for i, b in enumerate(body):
            P.rot(b, left=amp * osc(t, 1, i * waves / n))
        for nk in a.necks:
            for b in nk:
                P.rot(b, left=-amp * .35 * osc(t, 1, -.05), up=4 / len(nk))
    wavelength = sum(rig.arm.data.bones[b].length for b in body) / max(waves, .1)
    return fn, dict(duration=duration, loop=True, speed=.6 * wavelength / duration)


def make_fly(rig, duration=.9, hover=False):
    """Powered flight: downstroke fast and wide, upstroke folded; body rises on the downstroke.
    Flight clips stay at rest height - the game moves the actor through the air."""
    a = _anat(rig)

    def fn(P, t):
        flap = osc(t, 1)  # +1 = wings up
        down = max(0.0, -math.cos(TAU * t))  # 1 mid-downstroke
        for w in a.wings:
            n = len(w)
            for i, b in enumerate(w):
                lagged = osc(t, 1, -i * .09)  # tips lag behind the shoulder -> whip-like flex
                P.rot(b, up=(34 if i == 0 else 16) * lagged + (6 if i == 0 else 0),
                      fwd=(-14 * max(0, lagged)) if i else 6 * flap)  # fold slightly on the upstroke
        lift = a.H * (.06 if hover else .035)
        P.body(up=lift * osc(t, 1, -.3), pitch=(38 if hover else 6) + 3 * osc(t, 1, -.2))
        for l in rig.legs:  # tuck the legs, let them trail
            P.foot(l, up=a.L * .32 + lift * osc(t, 1, -.42), fwd=-a.L * (.05 if hover else .3))
        for nk in a.necks:
            for i, b in enumerate(nk):
                P.rot(b, up=(-(30 if hover else 5)) / len(nk) + 2 * osc(t, 1, -.35 - i * .08))
        for tl in a.tails:
            P.wave(tl, 4, 1, lag=.12, toward="up", phase=-.4)
            P.rot(tl[0], up=14 if not hover else -10)
        _arms_down(P, a)
    return fn, dict(duration=duration, loop=True)


def make_glide(rig, duration=4.0):
    a = _anat(rig)

    def fn(P, t):
        for w in a.wings:
            for i, b in enumerate(w):
                P.rot(b, up=(8 if i == 0 else 2) + 1.5 * osc(t, 2, -i * .1))
        P.body(up=a.H * .03 * osc(t, 1), roll=5 * osc(t, 1), pitch=3)
        for l in rig.legs:
            P.foot(l, up=a.L * .32, fwd=-a.L * .3)
        for tl in a.tails:
            P.wave(tl, 3, 1, lag=.1, toward="left")
            P.rot(tl[0], up=14)
        _arms_down(P, a)
    return fn, dict(duration=duration, loop=True)


def make_swim(rig, duration=1.8):
    """Tentacle / jet propulsion: arms spread, then snap together; mantle surges on the snap."""
    a = _anat(rig)

    def fn(P, t):
        power = pulse(t, .45, .62, .95)  # the stroke
        spread = pulse(t, 0, .35, .6)  # the recovery
        for tn in a.tentacles:
            for i, b in enumerate(tn):
                P.rot(b, up=(10 * spread - 16 * power) * (1 if i < 2 else .5) + 3 * osc(t, 1, -i * .12))
        P.body(up=a.H * (.3 + .1 * pulse(t, .5, .75, 1.0) - .04 * spread))
        for b in a.spine:
            P.rot(b, fwd=2 * osc(t, 1))
        _secondary(P, a, .6)
    return fn, dict(duration=duration, loop=True)


def make_attack(rig, duration=1.0):
    """Anticipation (coil back) -> fast strike -> overshoot -> settle. Bites with the head
    if there is a neck, otherwise swings an arm, otherwise lunges with the body."""
    a = _anat(rig)

    def fn(P, t):
        anti = pulse(t, 0, .3, .45)
        hit = pulse(t, .36, .5, .85)
        if a.arms and a.upright:
            arm = a.arms[-1].bones  # right arm
            up_arm = arm[1] if len(arm) >= 3 else arm[0]
            for c in a.arms:
                if c.bones is not arm:
                    _arms_down(P, type("x", (), {"arms": [c]})())
            P.rot(up_arm, up=-20 + 60 * anti - 70 * hit, fwd=-35 * anti + 95 * hit)
            if len(arm) > arm.index(up_arm) + 1:
                P.rot(arm[arm.index(up_arm) + 1], fwd=80 * anti + 15 * hit)
            P.rot(a.spine[-1], twist=-22 * anti + 30 * hit, fwd=10 * hit)
            P.body(fwd=a.L * (-.04 * anti + .12 * hit), up=-a.L * .05 * hit)
            P.foot(rig.legs[0], fwd=a.L * .28 * ease(min(1, t / .5)) * (1 - ease(max(0, (t - .8) / .2)))) if rig.legs else None
        else:
            P.body(fwd=a.L * (-.12 * anti + .3 * hit), up=-a.L * .08 * anti, pitch=6 * anti - 8 * hit)
            for nk in a.necks:
                for i, b in enumerate(nk[:-1]):
                    P.rot(b, up=14 * anti - 20 * hit)
                P.rot(nk[-1], up=-10 * anti + 16 * hit)
            if not a.necks and a.spine:
                P.rot(a.spine[-1], up=10 * anti - 12 * hit)
            if a.jaw:
                P.rot(a.jaw, up=-38 * pulse(t, .15, .42, .56))
            for i, l in enumerate(rig.legs):
                if l.pair == 0:  # front feet brace forward on the lunge
                    P.foot(l, fwd=a.L * .12 * hit)
        for tl in a.tails:
            P.wave(tl, 6, 2, lag=.15)
            P.rot(tl[0], up=10 * anti - 6 * hit)
        _fold_wings(P, a, 1 - .5 * anti)
    return fn, dict(duration=duration, loop=False)


def make_hit(rig, duration=.5):
    """Flinch: snaps back on frame 2-3, recovers slowly. Short so it can interrupt anything."""
    a = _anat(rig)

    def fn(P, t):
        k = pulse(t, 0, .18, 1.0)
        P.body(fwd=-a.L * .1 * k, up=-a.L * .04 * k, pitch=7 * k)
        if a.spine:
            P.rot(a.spine[-1], **({"fwd": -12 * k} if a.upright else {"up": 6 * k}))
        for nk in a.necks:
            for b in nk:
                P.rot(b, up=10 * k / len(nk) * (1 if not a.upright else -1), left=6 * k)
        _arms_down(P, a, bend=18 + 30 * k)
        _fold_wings(P, a, 1 - .35 * k)
        for tl in a.tails:
            P.wave(tl, 8 * k, 2, lag=.15)
    return fn, dict(duration=duration, loop=False)


def make_death(rig, duration=1.8):
    """Stagger, legs give way, body drops with a small bounce, extremities land last.
    Upright bodies topple forward onto their front; horizontal bodies collapse onto the belly."""
    a = _anat(rig)
    body_clear = min([rig.arm.data.bones[b].head_local.dot(rig.up) for b in a.spine] or [a.H]) - rig.ground

    def fn(P, t):
        stagger = pulse(t, 0, .15, .35)
        fall = ease((t - .2) / .45) if t > .2 else 0
        bounce = .06 * pulse(t, .65, .72, .85)
        late = ease((t - .45) / .4)  # extremities arrive after the body
        drop = body_clear * .9 * (fall - bounce)
        if a.upright:
            topple = ease((t - .3) / .45)
            P.body(up=-drop, fwd=-a.L * .08 * stagger + a.L * .15 * topple, pitch=6 * stagger - 84 * topple, roll=4 * late)
            for l in rig.legs:  # legs end up stretched out behind the hips
                P.foot(l, fwd=-a.L * .85 * topple, left=a.L * .08 * topple * (1 if l.side >= 0 else -1), pitch=-70 * topple)
            for c in a.arms:
                b = c.bones
                ua = b[1] if len(b) >= 3 else b[0]
                P.rot(ua, up=-74 * (1 - topple), fwd=25 * stagger)
            for nk in a.necks:
                P.rot(nk[-1], left=30 * late, up=8 * stagger)
        else:
            P.body(up=-drop, fwd=-a.L * .08 * stagger, roll=9 * late, pitch=5 * stagger)
            for l in rig.legs:  # feet slide outward as the legs give way
                P.foot(l, left=a.L * .3 * fall * (1 if l.side >= 0 else -1), fwd=a.L * .12 * fall * (1 if l.pair == 0 else -1))
            for nk in a.necks:
                for b in nk:
                    P.rot(b, up=8 * stagger - 110 * late / len(nk), left=-8 * late)
            _fold_wings(P, a, 1 - .55 * stagger - .35 * late)
            for w in a.wings:  # flare on the stagger, then go limp and slump
                P.rot(w[0], up=28 * stagger - 22 * late)
        if a.jaw:
            P.rot(a.jaw, up=-22 * late)
        for tl in a.tails:
            P.wave(tl, 10 * (1 - late), 2, lag=.15)
            for b in tl:
                P.rot(b, up=-4 * late)
        for tn in a.tentacles:
            P.wave(tn, 10 * (1 - late), 2, lag=.15, toward="up", bias=-6 * late)
    return fn, dict(duration=duration, loop=False, keep_above_ground=True)


def make_roar(rig, duration=2.2):
    a = _anat(rig)

    def fn(P, t):
        wind = pulse(t, 0, .18, .3)
        roar = pulse(t, .2, .35, 1.0) * (1 if t < .8 else ease((1 - t) / .2))
        shake = roar * osc(t, 9)
        P.body(up=-a.L * .06 * wind + a.L * .03 * roar, pitch=-4 * wind + 9 * roar)
        if a.spine:
            P.rot(a.spine[-1], **({"fwd": 8 * wind - 12 * roar} if a.upright else {"up": -5 * wind + 9 * roar}))
        for nk in a.necks:
            for b in nk[:-1]:
                P.rot(b, up=(-10 * wind + 16 * roar) / max(1, len(nk) - 1) * 2)
            P.rot(nk[-1], up=-8 * wind + 12 * roar + 1.5 * shake, left=2 * shake)
        if a.jaw:
            P.rot(a.jaw, up=-45 * roar + 3 * shake)
        for w in a.wings:  # wings flare open
            P.rot(w[0], up=18 + 25 * roar, fwd=-25 * (1 - roar))
            for b in w[1:]:
                P.rot(b, fwd=-38 * (1 - roar), up=-8 * (1 - roar) + 2 * shake)
        for c in a.arms:
            b = c.bones
            ua = b[1] if len(b) >= 3 else b[0]
            P.rot(ua, up=-74 + 40 * roar, fwd=-20 * roar)
            if len(b) > b.index(ua) + 1:
                P.rot(b[b.index(ua) + 1], fwd=18 + 50 * roar)
        for tl in a.tails:
            P.wave(tl, 5 + 6 * roar, 3, lag=.14)
            P.rot(tl[0], up=12 * roar)
        for tn in a.tentacles:
            P.wave(tn, 6 + 8 * roar, 3, lag=.12, toward="up", bias=5 * roar)
    return fn, dict(duration=duration, loop=False)


MAKERS = {
    "idle": make_idle,
    "walk": lambda r, **k: make_locomotion(r, "walk", **k),
    "run": lambda r, **k: make_locomotion(r, "run", **k),
    "slither": make_slither,
    "fly": make_fly,
    "hover": lambda r, **k: make_fly(r, hover=True, **k),
    "glide": make_glide,
    "swim": make_swim,
    "attack": make_attack,
    "hit": make_hit,
    "death": make_death,
    "roar": make_roar,
}


def suggest(rig):
    """Which stock clips fit this anatomy."""
    names = ["idle"]
    if rig.legs:
        names += ["walk", "run"]
    elif rig.by_role("tentacle"):
        names += ["swim"]
    else:
        names += ["slither"]
    if rig.by_role("wing"):
        names += ["fly", "hover", "glide"]
    names += ["attack", "hit", "death"]
    if rig.by_role("neck") or rig.by_role("tentacle"):
        names += ["roar"]
    return names


def add_standard(rig, names=None, **overrides):
    """overrides: {"walk": {"duration": 1.4}, ...} tweak individual makers."""
    done = []
    for n in names or suggest(rig):
        fn, kw = MAKERS[n](rig, **overrides.get(n, {}))
        rig.clip(n, fn, **kw)
        done.append(n)
    print("[creature_anim] clips:", ", ".join(done))
    return done
