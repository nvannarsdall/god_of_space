function buildTutorialSteps({ state, seekerCost, getRect, refs }) {
  return [
    {
      id: "omens",
      title: "Gather Omens",
      body: "Click the world to perform a small ritual. Each click grants Omens. Watch your Omens rise in the Status panel.",
      targets: [() => getRect(refs.world), () => getRect(refs.status)],
      target: () => getRect(refs.world),
      done: () => state.whispers >= 6,
      allow: { world: true },
    },
    {
      id: "seeker",
      title: "Call a Seeker",
      body: `Spend ${seekerCost} Omens to awaken. This creates your first follower. From now on, followers generate Reverence each second — Omens still remain useful.`,
      targets: [() => getRect(refs.seekerButton), () => getRect(refs.status)],
      target: () => getRect(refs.seekerButton),
      done: () => state.unlocked.awakened,
      allow: { seeker: true, world: true },
    },
    {
      id: "huts",
      title: "Build a Hut",
      body: "Buy 1 Hut. Huts unlock passive follower growth so Reverence keeps coming in each second.",
      targets: [() => getRect(refs.upgrades), () => getRect(refs.status)],
      target: () => getRect(refs.upgrades),
      done: () => (state.village.huts || 0) >= 1,
      allow: { villageUpgrades: true, world: true },
    },
    {
      id: "temple",
      title: "Build a Temple",
      body: "Buy 1 Temple to unlock conversion. You will soon turn Reverence into Authority.",
      targets: [() => getRect(refs.upgrades), () => getRect(refs.status)],
      target: () => getRect(refs.upgrades),
      done: () => (state.village.temples || 0) >= 1,
      allow: { villageUpgrades: true, world: true },
    },
    {
      id: "convert",
      title: "Convert Reverence",
      body: "Use Convert to turn Reverence into Authority. Authority is required to open the Sky tab.",
      targets: [() => getRect(refs.convertButton), () => getRect(refs.status)],
      target: () => getRect(refs.convertButton),
      done: () => state.power > 0,
      allow: { convert: true, world: true },
    },
    {
      id: "sky",
      title: "Reveal the Sky",
      body: "Open the Sky tab, click the sky for Starlight, then buy Starsong. Each Sky upgrade lowers the Veil and reveals the stars.",
      targets: [() => getRect(refs.skyTab), () => getRect(refs.world)],
      target: () => getRect(refs.skyTab),
      done: () => (state.sky.starsong || 0) >= 1,
      allow: { skyTab: true, skyUpgrades: true, world: true },
    },
  ];
}

export { buildTutorialSteps };
