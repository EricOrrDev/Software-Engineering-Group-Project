/* Loader and timestamp hydrator for seed_data.json. */
const LibrarySeed = (() => {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  let cachedData = null;

  function applyOffset(now, offset = {}) {
    return now + (offset.days ?? 0) * day + (offset.hours ?? 0) * hour;
  }

  function makeTool(record) {
    return {
      rate: 1,
      source: "Purchased",
      condition: "Working",
      status: "Available",
      safety: "",
      safetyNote: "",
      notes: "",
      audit: false,
      rank: null,
      donationChecked: record.source === "Donated",
      ...record
    };
  }

  function makePatron(record, { waiverVersion, waiverText, priorWaiver, now }) {
    const first = record.name.split(" ")[0].toLowerCase();
    const waivers = (record.waivers ?? []).map((entry) => {
      const version = entry.current ? waiverVersion : entry.version;
      const text = entry.text ?? (entry.current ? waiverText : priorWaiver?.text ?? "");
      return {
        version,
        text,
        signature: entry.signature ?? record.name,
        signedAt: applyOffset(now, entry.signedOffset)
      };
    });
    return {
      email: `${first}@example.test`,
      valid: true,
      holdLimit: 5,
      holdInterval: 0,
      blocked: false,
      reason: "",
      ...record,
      waivers
    };
  }

  function makeLoan(record, now) {
    const { checkedOutOffset, dueOffset, returnedOffset, ...rest } = record;
    return {
      returnedAt: returnedOffset ? applyOffset(now, returnedOffset) : null,
      lateFee: 0,
      condition: "",
      notes: "",
      lost: false,
      resolved: false,
      ...rest,
      checkedOutAt: applyOffset(now, checkedOutOffset),
      dueAt: applyOffset(now, dueOffset)
    };
  }

  function makeHold(record, now) {
    const { createdOffset, expiresOffset, ...rest } = record;
    return {
      extended: false,
      ...rest,
      createdAt: applyOffset(now, createdOffset),
      expiresAt: applyOffset(now, expiresOffset)
    };
  }

  async function load(url = "seed_data.json") {
    if (cachedData) return cachedData;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url} (HTTP ${response.status}).`);
    }
    cachedData = await response.json();
    return cachedData;
  }

  function create({ waiverVersion, waiverText, now = Date.now(), data = cachedData }) {
    if (!data) {
      throw new Error("Seed data has not been loaded yet.");
    }
    const { priorWaiver } = data;
    return {
      tools: (data.tools ?? []).map(makeTool),
      patrons: (data.patrons ?? []).map((patron) =>
        makePatron(patron, { waiverVersion, waiverText, priorWaiver, now })
      ),
      holds: (data.holds ?? []).map((hold) => makeHold(hold, now)),
      notifications: (data.notifications ?? []).map(({ createdOffset, ...rest }) => ({
        ...rest,
        createdAt: applyOffset(now, createdOffset)
      })),
      overrides: (data.overrides ?? []).map(({ createdOffset, ...rest }) => ({
        ...rest,
        createdAt: applyOffset(now, createdOffset)
      })),
      offset: 0,
      nextBarcode: data.nextBarcode ?? 600,
      loans: (data.loans ?? []).map((loan) => makeLoan(loan, now))
    };
  }

  return { load, create };
})();
