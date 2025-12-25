// Constellation data (Step 2D)
// UI should treat this as read-only. Logic lives in constellationLogic.js

export const CONSTELLATION_NODES = [
  {
    "id": "root_first_spark",
    "name": "First Spark",
    "desc": "The night sky remembers. Start each new cycle with +25 Divine Embers.",
    "cost": 1,
    "req": [],
    "pos": {
      "x": 0.5,
      "y": 0.18
    },
    "links": [
      "village_memory",
      "belief_rekindled",
      "sky_scars"
    ],
    "effects": {
      "startEmbers": 25
    }
  },
  {
    "id": "village_memory",
    "name": "Village Memory",
    "desc": "Your people rebuild faster. Start each new cycle with 1 Home already built.",
    "cost": 2,
    "req": [
      "root_first_spark"
    ],
    "pos": {
      "x": 0.28,
      "y": 0.45
    },
    "links": [],
    "effects": {
      "startHomes": 1
    }
  },
  {
    "id": "belief_rekindled",
    "name": "Belief Rekindled",
    "desc": "Faith returns faster. Faith is unlocked immediately in new cycles and Home-faith trickle is stronger.",
    "cost": 2,
    "req": [
      "root_first_spark"
    ],
    "pos": {
      "x": 0.5,
      "y": 0.52
    },
    "links": [],
    "effects": {
      "unlockFaithOnCycleStart": true,
      "faithRateMult": 1.08
    }
  },
  {
    "id": "sky_scars",
    "name": "Sky Scars",
    "desc": "Each shattering leaves a path. Gain +25% more Starlight from Prestige.",
    "cost": 3,
    "req": [
      "root_first_spark"
    ],
    "pos": {
      "x": 0.72,
      "y": 0.45
    },
    "links": [],
    "effects": {
      "starlightGainMult": 1.25
    }
  }
];
