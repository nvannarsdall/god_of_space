// Phase 3 Tutorial — clearer, system-first onboarding.
// The overlay uses `allow` to gate what the player can click.
//
// NOTE: Keep bodies as plain strings (we use template literals for readability).

export function buildTutorialSteps({ state, seekerCost, getRect, refs }) {
  const awakened = Boolean(state?.unlocked?.awakened);
  const omens = state?.whispers || 0;
  const devotion = state?.devotion || 0;

  const steps = [
    {
      id: "welcome",
      title: "A God, Forgotten",
      body: `You awaken beneath a heavy Veil. Your power is not gone — it is unremembered.

Click the village to perform a ritual and gather Omens.`,
      targets: [() => getRect(refs.world), () => getRect(refs.status)],
      target: () => getRect(refs.world),
      done: () => (state.whispers || 0) >= 5,
      allow: { world: true },
    },

    {
      id: "omens",
      title: "Omens Are Interventions",
      body: `Omens are not passive income — they're moments where you act.

Gather ${seekerCost} Omens so you can Call a Seeker.`,
      targets: [() => getRect(refs.world), () => getRect(refs.status)],
      target: () => getRect(refs.status),
      done: () => (state.whispers || 0) >= seekerCost,
      allow: { world: true },
    },

    {
      id: "seeker",
      title: "Call a Seeker",
      body: `Spend ${seekerCost} Omens to Call a Seeker.

This awakens you — Followers begin to gather, and Reverence can grow.`,
      targets: [() => getRect(refs.seekerButton), () => getRect(refs.status)],
      target: () => getRect(refs.seekerButton),
      done: () => Boolean(state?.unlocked?.awakened),
      allow: { seeker: true },
    },

    {
      id: "followers",
      title: "Followers Are Potential",
      body: `Followers represent how many people could believe in you.

You won't see every person on-screen — the village itself is the representation.

Objective: have at least 1 Follower.`,
      targets: [() => getRect(refs.status), () => getRect(refs.world)],
      target: () => getRect(refs.status),
      done: () => (state.followers || 0) >= 1,
      allow: { world: true, villageTab: true },
    },

    {
      id: "reverence",
      title: "Reverence Is Living Faith",
      body: `Reverence rises as Followers devote attention and ritual.

But faith fades if neglected — you must stabilize it with structures.`,
      targets: [() => getRect(refs.status), () => getRect(refs.actions)],
      target: () => getRect(refs.status),
      done: () => (state.devotion || 0) >= 10,
      allow: { world: true, villageTab: true },
    },

    {
      id: "decay",
      title: "Faith Fades",
      body: `Reverence is unstable under the Veil.

Temples, Shrines, and Festivals help hold belief in place.`,
      targets: [() => getRect(refs.actions), () => getRect(refs.status)],
      target: () => getRect(refs.actions),
      done: () => true,
      allow: { villageTab: true },
    },

    {
      id: "huts",
      title: "Build Shelter",
      body: `Huts stabilize the settlement and increase growth potential.

Buy a Hut to start passive follower growth.`,
      targets: [() => getRect(refs.actions), () => getRect(refs.upgradeHuts)],
      target: () => getRect(refs.upgradeHuts),
      done: () => (state.village?.huts || 0) >= 1,
      allow: { villageTab: true },
    },

    {
      id: "temple",
      title: "Build a Temple",
      body: `Temples deepen devotion and help stabilize Reverence over time.

Save up and buy your first Temple.`,
      targets: [
        () => getRect(refs.actions),
        () => getRect(refs.upgradeTemples),
      ],
      target: () => getRect(refs.upgradeTemples),
      done: () => (state.village?.temples || 0) >= 1,
      allow: { villageTab: true },
    },

    {
      id: "sky",
      title: "Look Up",
      body: `The sky is not decoration — it is your shattered memory.

Open the Sky to begin restoring Constellations (your true skill tree).`,
      targets: [() => getRect(refs.tabSky), () => getRect(refs.actions)],
      target: () => getRect(refs.tabSky),
      done: () => Boolean(state?.unlocked?.sky),
      allow: { skyTab: true },
    },
  ];

  // If awakened already, skip early steps gracefully.
  if (awakened) {
    // Find first step not completed; TutorialOverlay can handle being mid-stream.
    return steps;
  }

  return steps;
}
