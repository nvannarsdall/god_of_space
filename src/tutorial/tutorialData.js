// Phase 3 tutorial: integrates Prosperity + Portent + Sky + Constellations.
// The overlay uses `allow` to gate what the player can click.

function buildTutorialSteps({ state, seekerCost, getRect, refs }) {
  const isAwakened = Boolean(state?.unlocked?.awakened);

  return [
    {
      id: "omens",
      title: "Gather Omens",
      body:
        "Click the village to perform a ritual. Each click grants Omens. " +
        "Watch Omens rise in the Status panel.",
      targets: [() => getRect(refs.world), () => getRect(refs.status)],
      target: () => getRect(refs.world),
      done: () => (state.whispers || 0) >= 6,
      allow: { world: true },
    },
    {
      id: "seeker",
      title: "Call a Seeker",
      body:
        `Spend ${seekerCost} Omens to awaken. ` +
        "Once awakened, Followers generate Reverence every second — " +
        "and the village begins to prosper.",
      targets: [() => getRect(refs.seekerButton), () => getRect(refs.status)],
      target: () => getRect(refs.seekerButton),
      done: () => Boolean(state?.unlocked?.awakened),
      allow: { seeker: true },
    },
    {
      id: "huts",
      title: "Raise Huts",
      body:
        "Buy Huts to increase your Follower cap and unlock steady growth.",
      targets: [() => getRect(refs.upgrades), () => getRect(refs.status)],
      target: () => getRect(refs.upgrades),
      done: () => (state.village?.huts || 0) >= 1,
      allow: { villageUpgrades: true },
    },
    {
      id: "temple",
      title: "Build a Temple",
      body:
        "Temples deepen reverence and unlock more paths. Buy your first Temple.",
      targets: [() => getRect(refs.upgrades), () => getRect(refs.status)],
      target: () => getRect(refs.upgrades),
      done: () => (state.village?.temples || 0) >= 1,
      allow: { villageUpgrades: true },
    },
    {
      id: "prosperity",
      title: "Let the Village Prosper",
      body:
        "Prosperity grows automatically once awakened — and it boosts Reverence yield. " +
        "Watch Prosperity rise in the Status panel.",
      targets: [() => getRect(refs.status)],
      target: () => getRect(refs.status),
      done: () => (state.village?.prosperity || 0) >= 10,
      allow: { world: true, villageUpgrades: true },
    },
    {
      id: "portent",
      title: "Ignite a Portent",
      body:
        "Spend Omens to ignite a Portent. While active, it boosts growth and prosperity.",
      targets: [() => getRect(refs.portentButton), () => getRect(refs.status)],
      target: () => getRect(refs.portentButton),
      done: () => (state.buffs?.portentUntil || 0) > (state.t || 0),
      allow: { world: true },
    },
    {
      id: "sky",
      title: "Reveal the Sky",
      body:
        "Open the Sky tab, click the sky for Starlight, then buy Starsong. " +
        "Sky upgrades lower the Veil and reveal the stars.",
      targets: [() => getRect(refs.skyTab), () => getRect(refs.world)],
      target: () => getRect(refs.skyTab),
      done: () => (state.sky?.starsong || 0) >= 1,
      allow: { skyTab: true, skyUpgrades: true, world: true },
    },
    {
      id: "constellations",
      title: "Restore a Constellation",
      body:
        "Open the Constellations tab and spend Constellation Points to restore your first star-path. " +
        "Constellations grant permanent, branching bonuses.",
      targets: [() => getRect(refs.constellationsTab)],
      target: () => getRect(refs.constellationsTab),
      done: () => (state.constellations?.unlocked || []).includes("root_dusk"),
      allow: { constellationsTab: true },
    },
  ];
}

export { buildTutorialSteps };
