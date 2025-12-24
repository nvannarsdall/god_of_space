// Phase B objective system — informative only, never blocks UI.

export function getObjective(state, computed) {
  const embers = state.embers || 0;
  const homes = state.village?.huts || 0; // huts are displayed as Homes in Phase B
  const passive = state.stats?.passiveEmbers || 0;

  // Objectives are ordered; the first unmet one is active.
  const objectives = [
    {
      id: "first_spark",
      text: `Restore the First Spark (0/1 Embers)`,
      done: embers >= 1,
    },
    {
      id: "gather_power",
      text: `Gather Power (${Math.min(10, Math.floor(embers))}/10 Embers)`,
      done: embers >= 10,
    },
    {
      id: "shelter",
      text: `Shelter the Village (Build ${Math.min(1, homes)}/1 Home)`,
      done: homes >= 1,
    },
    {
      id: "hearths",
      text: `Let the Hearths Glow (${Math.min(5, Math.floor(passive))}/5 Embers passively)`,
      done: passive >= 5,
    },
    {
      id: "expand",
      text: `Expand the Hamlet (Build ${Math.min(3, homes)}/3 Homes)`,
      done: homes >= 3,
    },
    {
      id: "stoke",
      text: `Stoke the Flame (${Math.min(50, Math.floor(embers))}/50 Embers)`,
      done: embers >= 50,
    },
  ];

  const active = objectives.find((o) => !o.done) || {
    id: "complete",
    text: "The village steadies. More mysteries await…",
    done: true,
  };

  return active;
}
