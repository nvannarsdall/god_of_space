function buildTutorialSteps({ state, seekerCost, getRect, refs }) {
  return [
    {
      id: "omens",
      title: "Gather Omens",
      body: "Click the world to gain Omens. Omens are only used to call a Seeker and awaken your power.",
      target: () => getRect(refs.world),
      done: () => state.whispers >= 6,
      allow: { world: true },
    },
    {
      id: "seeker",
      title: "Call a Seeker",
      body: `Spend ${seekerCost} Omens to awaken. This creates your first follower and turns clicks into Reverence.`,
      target: () => getRect(refs.seekerButton),
      done: () => state.unlocked.awakened,
      allow: { seeker: true, world: true },
    },
    {
      id: "huts",
      title: "Build a Hut",
      body: "Buy 1 Hut. Huts unlock passive follower growth so Reverence keeps coming in each second.",
      target: () => getRect(refs.upgrades),
      done: () => (state.village.huts || 0) >= 1,
      allow: { villageUpgrades: true, world: true },
    },
    {
      id: "temple",
      title: "Build a Temple",
      body: "Buy 1 Temple to unlock conversion. You will soon turn Reverence into Authority.",
      target: () => getRect(refs.upgrades),
      done: () => (state.village.temples || 0) >= 1,
      allow: { villageUpgrades: true, world: true },
    },
    {
      id: "convert",
      title: "Convert Reverence",
      body: "Use Convert to turn Reverence into Authority. Authority is required to open the Sky tab.",
      target: () => getRect(refs.convertButton),
      done: () => state.power > 0,
      allow: { convert: true, world: true },
    },
    {
      id: "sky",
      title: "Reveal the Sky",
      body: "Open the Sky tab, click the sky for Starlight, then buy Starsong. Each Sky upgrade lowers the Veil and reveals the stars.",
      target: () => getRect(refs.skyTab),
      done: () => (state.sky.starsong || 0) >= 1,
      allow: { skyTab: true, skyUpgrades: true, world: true },
    },
  ];
}

export { buildTutorialSteps };
