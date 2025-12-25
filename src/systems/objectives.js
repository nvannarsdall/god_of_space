// Phase B objective system — informative only, never blocks UI.
import { computeStarlightGain, computeNextStarlightFaith } from "../game/compute";

export function getObjective(state, computed) {
  const embers = state.embers || 0;
  const homes = state.village?.huts || 0; // huts are displayed as Homes in Phase B
  const passive = state.stats?.passiveEmbers || 0;

  const faith =
    typeof state.faith === "number"
      ? state.faith
      : typeof state.devotion === "number"
      ? state.devotion
      : 0;

  const starlightTotal = state.meta?.starlight || 0;
  const starlightGainPreview = computeStarlightGain(state);
  const nextFaith = computeNextStarlightFaith(state);
  const constellationCount = (state.constellations?.unlocked || []).length;

  // Objectives are ordered; the first unmet one is active.
  const objectives = [
    {
      id: "first_spark",
      text: `Restore the First Spark (${Math.min(
        1,
        Math.floor(embers)
      )}/1 Ember)`,
      done: embers >= 1,
    },
    {
      id: "shelter",
      text: `Raise Shelter (${Math.min(1, homes)}/1 Home)`,
      done: homes >= 1,
    },
    {
      id: "ember_flow",
      text: `Let Embers Flow (${Math.min(
        5,
        Math.floor(passive)
      )}/5 Passive Embers)`,
      done: passive >= 5,
    },
    {
      id: "stoke",
      text: `Stoke the Flame (${Math.min(50, Math.floor(embers))}/50 Embers)`,
      done: embers >= 50,
    },

    // Faith chapter
    {
      id: "awaken_belief",
      text: `Awaken Belief (${Math.min(1, Math.floor(faith))}/1 Faith)`,
      done: faith >= 1,
    },

    // Prestige chapter
    {
      id: "touch_firmament",
      text: `Touch the Firmament (Prepare 1 Starlight)`,
      subtext:
        starlightGainPreview > 0
          ? `Prestige would grant +${starlightGainPreview} Starlight`
          : nextFaith
          ? (() => {
              const totalFaith =
                typeof state?.stats?.totalFaithEarned === "number"
                  ? state.stats.totalFaithEarned
                  : typeof state?.faith === "number"
                  ? state.faith
                  : typeof state?.devotion === "number"
                  ? state.devotion
                  : 0;
              const remaining = Math.max(0, Math.ceil(nextFaith - totalFaith));
              return `Next Starlight at ${nextFaith} total Faith this cycle (${remaining} more)`;
            })()
          : `Accumulate more Faith to earn Starlight on Prestige`,
      done: starlightGainPreview >= 1,
    },
    {
      id: "shatter_sky",
      text: `Shatter the Sky (Earn 1 Starlight)`,
      subtext:
        starlightGainPreview > 0
          ? `Shatter the Sky to gain +${starlightGainPreview} Starlight`
          : `Build more Faith before you can Shatter the Sky`,
      done: starlightTotal >= 1,
    },
    {
      id: "restore_star",
      text: `Restore a Star (${Math.min(1, constellationCount)}/1 Constellation)`,
      subtext:
        starlightTotal > 0
          ? "Open Constellations and spend Starlight to unlock a permanent node."
          : "Earn Starlight first.",
      done: constellationCount >= 1,
    },
  ];

  const active = objectives.find((o) => !o.done) || {
    id: "complete",
    text: "A new cycle begins. The constellations whisper…",
    done: true,
  };

  return active;
}
