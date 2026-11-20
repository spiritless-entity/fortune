const SHARD_MONTHLY_CAP = 5;
const SHARD_OVERFLOW_CASH = 500;
const ARTEFACT_FORGE_SHARD_COSTS = Object.freeze({
  1: 1,
  2: 1,
  3: 2,
  4: 2,
  5: 3,
  6: 3,
  7: 4,
  8: 5
});

function getUtcMonthKey(value = Date.now()) {
  return new Date(value).toISOString().slice(0, 7);
}

function createArtefactHelpers(rarities) {
  const rarityByStars = new Map(rarities.map(rarity => [rarity.stars, rarity]));
  const nativeStarsByName = new Map();

  for (const rarity of rarities) {
    for (const item of rarity.items) {
      if (!nativeStarsByName.has(item)) nativeStarsByName.set(item, rarity.stars);
    }
  }

  function parseArtefactName(value) {
    const original = String(value || '');
    const isShiny = original.startsWith('✨ SHINY ') && original.endsWith(' ✨');
    let baseName = isShiny ? original.slice(8, -2) : original;
    let stars = null;
    const explicitStar = baseName.match(/ \[(\d+)-Star\]$/);

    if (explicitStar) {
      stars = Number(explicitStar[1]);
      baseName = baseName.slice(0, -explicitStar[0].length);
    } else {
      stars = nativeStarsByName.get(baseName) || null;
    }

    return { baseName, stars, isShiny };
  }

  function makeArtefactName(baseName, stars, isShiny = false) {
    const nativeStars = nativeStarsByName.get(baseName);
    const suffix = stars === nativeStars ? '' : ` [${stars}-Star]`;
    const name = `${baseName}${suffix}`;
    return isShiny ? `✨ SHINY ${name} ✨` : name;
  }

  function getArtefactBaseName(value) {
    return parseArtefactName(value).baseName;
  }

  function getArtefactStarLevel(value) {
    return parseArtefactName(value).stars;
  }

  function isShinyArtefact(value) {
    return parseArtefactName(value).isShiny;
  }

  function getRarityByArtefactName(value) {
    const { stars } = parseArtefactName(value);
    return rarityByStars.get(stars) || null;
  }

  function getCollectionKey(value) {
    const { baseName, stars } = parseArtefactName(value);
    return stars ? makeArtefactName(baseName, stars) : baseName;
  }

  function ensureShardLedger(user, now = Date.now()) {
    const monthKey = getUtcMonthKey(now);
    if (!user.artifactShardLedger || typeof user.artifactShardLedger !== 'object') {
      user.artifactShardLedger = { balance: 0, earnedThisMonth: 0, monthKey };
    }

    const ledger = user.artifactShardLedger;
    ledger.balance = Math.max(0, Math.floor(Number(ledger.balance) || 0));
    ledger.earnedThisMonth = Math.min(
      SHARD_MONTHLY_CAP,
      Math.max(0, Math.floor(Number(ledger.earnedThisMonth) || 0))
    );

    if (ledger.monthKey !== monthKey) {
      ledger.earnedThisMonth = 0;
      ledger.monthKey = monthKey;
    }

    return ledger;
  }

  function awardArtifactShards(user, requested, now = Date.now()) {
    const ledger = ensureShardLedger(user, now);
    const amount = Math.max(0, Math.floor(Number(requested) || 0));
    const awarded = Math.min(amount, Math.max(0, SHARD_MONTHLY_CAP - ledger.earnedThisMonth));
    const overflow = amount - awarded;

    ledger.balance += awarded;
    ledger.earnedThisMonth += awarded;
    user.cash = (Number(user.cash) || 0) + overflow * SHARD_OVERFLOW_CASH;

    return {
      requested: amount,
      awarded,
      overflow,
      balance: ledger.balance,
      earnedThisMonth: ledger.earnedThisMonth,
      cashCompensation: overflow * SHARD_OVERFLOW_CASH,
      monthKey: ledger.monthKey
    };
  }

  return {
    parseArtefactName,
    makeArtefactName,
    getArtefactBaseName,
    getArtefactStarLevel,
    isShinyArtefact,
    getRarityByArtefactName,
    getCollectionKey,
    ensureShardLedger,
    awardArtifactShards
  };
}

module.exports = {
  SHARD_MONTHLY_CAP,
  SHARD_OVERFLOW_CASH,
  ARTEFACT_FORGE_SHARD_COSTS,
  getUtcMonthKey,
  createArtefactHelpers
};
