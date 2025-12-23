// Slower, clearer tutorial for God of Space.
// The overlay uses `allow` to gate what the player can click.

export function buildTutorialSteps({ state, seekerCost, getRect, refs }) {
  const awakened = Boolean(state?.unlocked?.awakened);
  const omens = state?.whispers || 0;

  return [
    {
      id: "welcome",
      title: "Your Dusk Begins",
      body:
        "You are a weakened god. The village still remembers.\n\n" +
        "First, perform rituals: CLICK the village to gather Omens.",
      targets: [() => getRect(refs.world), () => getRect(refs.status)],
      target: () => getRect(refs.world),
      done: () => (state.whispers || 0) >= 5,
      allow: { world: true },
    },
    {
      id: "omens",
      title: "Watch Your Omens",
      body:
        "Omens are shown in the Status panel.\n\n" +
        "Gather enough to call a Seeker and awaken your power.",
      targets: [() => getRect(refs.status), () => getRect(refs.world)],
      target: () => getRect(refs.status),
      done: () => (state.whispers || 0) >= seekerCost,
      allow: { world: true },
    },
    {
      id: "seeker",
      title: "Call a Seeker",
      body:
        `Spend ${seekerCost} Omens to call a Seeker. ` +
        "This awakens you — Followers begin to gather, and Reverence can grow.",
      targets: [() => getRect(refs.seekerButton), () => getRect(refs.status)],
      target: () => getRect(refs.seekerButton),
      done: () => Boolean(state?.unlocked?.awakened),
      allow: { seeker: true },
    },
    {
      id: "reverence",
      title: "Reverence Grows Over Time",
      body:
        "Now that you are awakened, Followers generate Reverence every second.\n\n" +
        "Wait a moment and watch Reverence increase.",
      targets: [() => getRect(refs.status)],
      target: () => getRect(refs.status),
      done: () => (state.devotion || 0) >= 10,
      allow: { world: true },
    },
    {
      id: "huts",
      title: "Build Huts",
      body:
        "Huts increase your Follower cap and stabilize growth.\n\n" +
        "Buy your first Hut.",
      targets: [() => getRect(refs.upgrades), () => getRect(refs.status)],
      target: () => getRect(refs.upgrades),
      done: () => (state.village?.huts || 0) >= 1,
      allow: { villageUpgrades: true },
    },
    {
      id: "farms",
      title: "Build Farms",
      body:
        "Farms help the settlement thrive and improve Reverence gains.\n\n" +
        "Buy your first Farm.",
      targets: [() => getRect(refs.upgrades), () => getRect(refs.status)],
      target: () => getRect(refs.upgrades),
      done: () => (state.village?.farms || 0) >= 1,
      allow: { villageUpgrades: true },
    },
    {
      id: "sky",
      title: "Look Up",
      body:
        "The sky is dim — but not gone.\n\n" +
        "Click the sky to gather Starlight, and open the Sky tab.",
      targets: [() => getRect(refs.skyTab), () => getRect(refs.world)],
      target: () => getRect(refs.skyTab),
      done: () => (state.stardust || 0) >= 1 && Boolean(state.unlocked?.sky),
      allow: { world: true, skyTab: true },
    },
    {
      id: "starsong",
      title: "Restore a First Constellation",
      body:
        "Buy Starsong to begin restoring the night sky.\n\n" +
        "This is the start of your constellation path.",
      targets: [() => getRect(refs.skyTab)],
      target: () => getRect(refs.skyTab),
      done: () => (state.sky?.starsong || 0) >= 1,
      allow: { skyTab: true, skyUpgrades: true, world: true },
    },
    {
      id: "finish",
      title: "Freeplay",
      body:
        "You’re ready.\n\n" +
        "Keep expanding the village and rebuilding the sky. The dusk answers to you.",
      targets: [() => getRect(refs.status)],
      target: () => getRect(refs.status),
      done: () => true,
      allow: {
        world: true,
        villageUpgrades: true,
        skyTab: true,
        skyUpgrades: true,
      },
    },
  ];
}
