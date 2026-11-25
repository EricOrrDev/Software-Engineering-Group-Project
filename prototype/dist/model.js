/* Browser-local data and circulation rules for the tool library demo. */
const Library = (() => {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const storageKey = "county-tool-library-v1";
  const waiverVersion = "1.0";
  const waiverText = "I agree to use library tools responsibly, follow the manufacturer’s instructions and available safety guidance, and return borrowed tools by their due dates. I understand that the library records borrowing activity and may assess fees for late returns.";

  function seed() {
    const start = Date.now();
    const central = "Central Tool Library";
    const north = "North Workshop";
    const tools = [
      { barcode: "T-104", name: "Hedge trimmer", category: "Lawn & Garden", branch: central, model: "Cordless · 22 inch", days: 7, value: 90, rank: 24, description: "A cordless trimmer for shaping hedges and maintaining shrubs." },
      { barcode: "T-205", name: "Tile saw", category: "Home Repair", branch: central, model: "Wet saw · 7 inch", days: 3, value: 160, rate: 3, rank: 3, description: "A wet saw for straight cuts in ceramic and porcelain tile." },
      { barcode: "T-221", name: "Circular saw", category: "Woodworking", branch: central, model: "Corded · 7¼ inch", days: 7, value: 100, rank: 18, status: "Checked out", description: "A handheld saw for straight cuts in boards and sheet goods." },
      { barcode: "T-310", name: "Compact router", category: "Woodworking", branch: central, model: "Fixed base · ¼ inch", days: 7, value: 120, rank: 31, description: "A compact router for rounding edges and cutting profiles in wood.", safetyNote: "Read the manufacturer’s manual before use. Wear eye and hearing protection, secure the workpiece, and disconnect power before changing bits." },
      { barcode: "T-401", name: "Post-hole digger", category: "Lawn & Garden", branch: north, model: "Manual · 48 inch", days: 3, value: 65, rate: 3, rank: 14, description: "A manual clamshell digger for fence and garden posts." },
      { barcode: "T-415", name: "Pressure washer", category: "Cleaning", branch: north, model: "Electric · 1,800 PSI", days: 3, value: 140, rate: 3, rank: 8, description: "An electric washer for outdoor cleaning projects." },
      { barcode: "T-501", name: "Hex-key set", category: "Hand Tools", branch: central, model: "Metric · 9 piece", days: 14, value: 5, rank: 40, status: "Checked out", description: "A compact set for common hex fasteners." },
      { barcode: "T-521", name: "Orbital sander", category: "Woodworking", branch: north, model: "Random orbit · 5 inch", days: 14, value: 55, rank: 26, source: "Donated", audit: true, notes: "Confirm the replacement value and inspect the dust bag.", description: "A handheld sander for smoothing flat wooden surfaces." }
    ].map(tool => ({
      rate: 1, source: "Purchased", condition: "Working", status: "Available",
      safety: "", safetyNote: "", notes: "", audit: false, donationChecked: tool.source === "Donated", ...tool
    }));
    const patrons = [
      ["1001", "Paul Example", 42], ["1002", "Saul Example", 37], ["1003", "Debby Example", 39],
      ["1004", "Franklin Example", 46], ["1005", "Roy Example", 35], ["1006", "Cathy Example", 33],
      ["1007", "Billy Example", 17], ["1008", "Rick Example", 30]
    ].map(([card, name, age]) => ({
      card, name, age, email: `${name.split(" ")[0].toLowerCase()}@example.test`, valid: true,
      holdLimit: card === "1008" ? 1 : 5, holdInterval: 0, blocked: false, reason: "",
      waivers: ["1004", "1005", "1006"].includes(card)
        ? [{ version: waiverVersion, text: waiverText, signature: name, signedAt: start - 45 * day }]
        : []
    }));
    return {
      tools, patrons, holds: [], notifications: [], overrides: [], offset: 0, nextBarcode: 600,
      loans: [
        { barcode: "T-221", card: "1005", checkedOutAt: start - 4 * day, dueAt: start + 3 * day, rate: 1, value: 100 },
        { barcode: "T-501", card: "1006", checkedOutAt: start - 28 * day, dueAt: start - 14 * day, rate: 1, value: 5 }
      ].map(loan => ({ returnedAt: null, lateFee: 0, condition: "", notes: "", lost: false, resolved: false, ...loan }))
    };
  }

  function read() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) ?? seed();
    } catch {
      return seed();
    }
  }

  let state = read();

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // The current session remains usable when browser storage is disabled.
    }
  }

  function now() {
    return Date.now() + state.offset;
  }

  function requireRule(condition, message) {
    if (!condition) throw new Error(message);
  }

  const clean = value => String(value ?? "").trim();
  const tool = barcode => state.tools.find(item => item.barcode === clean(barcode).toUpperCase());
  const patron = query => state.patrons.find(person => person.card === clean(query) || person.name.toLowerCase() === clean(query).toLowerCase());
  const hold = id => state.holds.find(record => record.id === clean(id).toUpperCase());
  const activeLoans = card => state.loans.filter(record => record.card === card && !record.returnedAt && !record.lost);
  const currentHolds = card => state.holds.filter(record => record.card === card && record.status === "Active");

  function expire() {
    const time = now();
    const elapsed = state.holds.filter(record => record.status === "Active" && record.expiresAt <= time);
    for (const record of elapsed) {
      record.status = "Expired";
      tool(record.barcode).status = "Available";
      const borrower = patron(record.card);
      state.notifications.push({
        id: `N-${record.id}`, holdId: record.id, card: record.card, email: borrower.email,
        message: `Your hold for ${tool(record.barcode).name} has expired.`, createdAt: time, status: "Simulated"
      });
    }
    if (elapsed.length) save();
    return elapsed.length;
  }

  function activeHolds(card) {
    expire();
    return currentHolds(card);
  }

  function checkCard(card) {
    const person = patron(card);
    requireRule(person?.valid, "The county library card could not be verified.");
    return person;
  }

  function borrowingBlock(person) {
    if (person.blocked) return person.reason || "Tool borrowing is restricted.";
    if (state.loans.some(loan => loan.card === person.card && loan.lost && !loan.resolved)) {
      return "Resolve the unreturned tool before borrowing again.";
    }
    return "";
  }

  function placeHold(barcode, card) {
    expire();
    const person = checkCard(card);
    requireRule(person.card === clean(card), "Enter a valid county library card number.");
    const block = borrowingBlock(person);
    requireRule(!block, block);
    const copy = tool(barcode);
    requireRule(copy?.status === "Available", "This copy is no longer available to hold.");
    const time = now();
    requireRule(currentHolds(person.card).length < person.holdLimit, "This patron has reached their active hold limit.");
    requireRule(!state.holds.some(record => record.card === person.card && record.createdAt + person.holdInterval * day > time),
      "This patron must wait before placing another hold.");
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), byte => byte.toString(16).padStart(2, "0")).join("");
    const id = `H-${code.toUpperCase()}`;
    const record = { id, card: person.card, barcode: copy.barcode, branch: copy.branch, createdAt: time, expiresAt: time + day, status: "Active", extended: false };
    state.holds.push(record);
    copy.status = "On hold";
    save();
    return record;
  }

  function extensionReason(id) {
    expire();
    const record = hold(id);
    if (record?.status !== "Active") return "Only active holds can be extended.";
    if (record.extended) return "This hold has already been extended.";
    const rank = tool(record.barcode).rank;
    if (rank !== null && rank <= 20) return "This tool is among the 20 most frequently borrowed and is ineligible for extensions.";
    return borrowingBlock(patron(record.card));
  }

  function extendHold(id) {
    const reason = extensionReason(id);
    requireRule(!reason, reason);
    const record = hold(id);
    record.expiresAt += day;
    record.extended = true;
    save();
    return record;
  }

  function verify(card, verification) {
    const person = checkCard(card);
    requireRule(person.age >= 18, "Patrons must be at least 18 to check out tools.");
    const block = borrowingBlock(person);
    requireRule(!block, block);
    requireRule(!activeLoans(person.card).some(loan => loan.dueAt < now()),
      "Return overdue tools before starting a new checkout.");
    requireRule(verification?.photoId || clean(verification?.overrideReason), "Confirm photo ID or record an override reason.");
    requireRule(verification?.ageConfirmed, "Confirm that the patron is at least 18.");
    return person;
  }

  function signWaiver(card, signature) {
    const person = checkCard(card);
    requireRule(person.age >= 18, "Only adult patrons can sign the tool library waiver.");
    requireRule(clean(signature), "Enter the patron’s electronic signature.");
    const current = person.waivers.find(waiver => waiver.version === waiverVersion);
    if (current) return current;
    const record = { version: waiverVersion, text: waiverText, signature: clean(signature), signedAt: now() };
    person.waivers.push(record);
    save();
    return record;
  }

  function validateSelection(card, barcodes) {
    const person = checkCard(card);
    expire();
    requireRule(barcodes.length > 0, "Add at least one barcode to check out.");
    requireRule(activeLoans(person.card).length + barcodes.length <= 5, "A patron can borrow at most five tools at a time.");
    const copies = barcodes.map(barcode => {
      const copy = tool(barcode);
      requireRule(copy, `Barcode ${clean(barcode)} does not match a library tool.`);
      const held = currentHolds(person.card).some(record => record.barcode === copy.barcode);
      requireRule(copy.status === "Available" || held, `${copy.name} (${copy.barcode}) is unavailable to this patron.`);
      return copy;
    });
    requireRule(new Set(copies).size === copies.length, "Each barcode can be added only once.");
    return copies;
  }

  function dueAt(barcode) {
    return now() + tool(barcode).days * day;
  }

  function checkout(card, barcodes, verification) {
    const person = verify(card, verification);
    requireRule(person.waivers.some(waiver => waiver.version === waiverVersion), "The current waiver must be signed before checkout.");
    const copies = validateSelection(person.card, barcodes);
    const time = now();
    const loans = copies.map(copy => {
      const reservation = currentHolds(person.card).find(record => record.barcode === copy.barcode);
      if (reservation) reservation.status = "Picked up";
      copy.status = "Checked out";
      return {
        card: person.card, barcode: copy.barcode, checkedOutAt: time, dueAt: time + copy.days * day,
        rate: copy.rate, value: copy.value, returnedAt: null, lateFee: 0, condition: "", notes: "", lost: false, resolved: false
      };
    });
    state.loans.push(...loans);
    if (!verification.photoId) {
      state.overrides.push({ card: person.card, reason: clean(verification.overrideReason), createdAt: time });
    }
    save();
    return loans;
  }

  function previewReturn(barcode) {
    const copy = tool(barcode);
    const loan = state.loans.find(record => record.barcode === copy?.barcode && !record.returnedAt && !record.lost);
    requireRule(loan, "This barcode does not match an active tool loan.");
    const graceUntil = loan.dueAt + day;
    const lateDays = Math.max(0, Math.ceil((now() - graceUntil) / day));
    const lateFee = Math.min(lateDays * loan.rate, 20, loan.value);
    return { tool: copy, loan, patron: patron(loan.card), graceUntil, lateDays, lateFee };
  }

  function returnTool(barcode, { condition, notes }) {
    const quote = previewReturn(barcode);
    requireRule(["Working", "Damaged", "Broken"].includes(condition), "Select the returned tool’s condition.");
    requireRule(condition === "Working" || clean(notes), "Enter notes about the damage.");
    Object.assign(quote.loan, { returnedAt: now(), lateFee: quote.lateFee, condition, notes: clean(notes) });
    Object.assign(quote.tool, { condition, status: condition === "Working" ? "Available" : "Maintenance" });
    save();
    return quote.loan;
  }

  function markLost(barcode, notes) {
    const quote = previewReturn(barcode);
    requireRule(quote.loan.dueAt < now(), "A tool can be marked unreturned after its due date.");
    requireRule(clean(notes), "Enter a note explaining why the tool is marked unreturned.");
    Object.assign(quote.loan, { lost: true, condition: "Lost", notes: clean(notes), lateFee: Math.min(20, quote.loan.value) });
    Object.assign(quote.tool, { status: "Retired", condition: "Lost", notes: clean(notes) });
    save();
    return quote.loan;
  }

  function resolveLoss(barcode) {
    const copy = tool(barcode);
    const loan = state.loans.find(record => record.barcode === copy?.barcode && record.lost && !record.resolved);
    requireRule(loan, "This barcode has no unresolved loss.");
    loan.resolved = true;
    save();
    return loan;
  }

  function saveTool(fields, existingBarcode) {
    expire();
    const existing = existingBarcode ? tool(existingBarcode) : undefined;
    requireRule(!existingBarcode || existing, "This tool does not exist.");
    const name = clean(fields.name);
    const category = clean(fields.category);
    const branch = clean(fields.branch);
    const days = Number(fields.days);
    const value = Number(fields.value);
    const rate = Number(fields.rate);
    const notes = clean(fields.notes);
    const safety = clean(fields.safety);
    const source = fields.source ?? "Purchased";
    const audit = Boolean(fields.audit);
    const condition = fields.condition ?? existing?.condition ?? "Working";
    const status = fields.status ?? existing?.status ?? "Available";
    requireRule(name && category && branch, "Enter a tool name, category, and location.");
    requireRule(clean(fields.days) && days > 0 && days <= 14, "Enter a loan period greater than zero and no more than 14 days.");
    requireRule(clean(fields.value) && Number.isFinite(value) && value >= 0, "Enter a valid replacement value.");
    requireRule([1, 3].includes(rate), "Select a late-fee class.");
    requireRule(["Purchased", "Donated"].includes(source), "Select an acquisition source.");
    const donationChecked = Boolean(fields.donationChecked || (existing?.source === "Donated" && existing.donationChecked));
    requireRule(source !== "Donated" || donationChecked, "Confirm the donated tool passed inspection.");
    requireRule(!safety || /^https?:\/\/[^\s]+$/i.test(safety), "Enter a complete http or https safety link.");
    requireRule(!audit || notes, "Add notes for the audit queue.");
    requireRule(status !== "Retired" || notes, "Enter a retirement reason in the notes.");
    requireRule(["Available", "Maintenance", "Retired"].includes(status) || status === existing?.status, "Select a valid inventory status.");
    requireRule(!["On hold", "Checked out"].includes(existing?.status) || status === existing.status,
      "Complete the hold or loan before changing this copy’s status.");
    requireRule(existing?.status !== "On hold" || branch === existing.branch, "Complete the hold before changing its pickup location.");
    requireRule(status !== "Available" || !["Damaged", "Broken", "Lost"].includes(condition), "Select maintenance or retired for a non-working tool.");
    requireRule(status === "Retired" || !state.loans.some(record => record.barcode === existing?.barcode && record.lost && !record.resolved),
      "Resolve the loss before returning this copy to circulation.");
    let barcode = existing?.barcode;
    if (!barcode) {
      while (tool(`T-${state.nextBarcode}`)) state.nextBarcode++;
      barcode = `T-${state.nextBarcode++}`;
    }
    const record = { barcode, name, category, branch, days, value, rate, notes, safety, source, audit, condition, status,
      model: clean(fields.model), description: clean(fields.description), rank: existing?.rank ?? null,
      safetyNote: existing?.safetyNote ?? "", donationChecked };
    if (existing) Object.assign(existing, record);
    else state.tools.push(record);
    save();
    return record;
  }

  function saveRestrictions(card, { holdLimit, holdInterval, blocked, reason }) {
    const person = checkCard(card);
    const limit = Number(holdLimit);
    const interval = Number(holdInterval);
    requireRule(clean(holdLimit) && Number.isSafeInteger(limit) && limit >= 0, "Enter a whole number for the hold limit.");
    requireRule(clean(holdInterval) && Number.isSafeInteger(interval) && interval >= 0, "Enter a whole number of days between holds.");
    requireRule(!blocked || clean(reason), "Enter a reason for blocking tool borrowing.");
    Object.assign(person, { holdLimit: limit, holdInterval: interval, blocked: Boolean(blocked), reason: clean(reason) });
    save();
    return person;
  }

  function advanceHours(hours) {
    requireRule(Number.isFinite(hours) && hours >= 0, "Enter a positive number of hours.");
    state.offset += hours * hour;
    save();
    return expire();
  }

  function reset() {
    state = seed();
    save();
  }

  function reload() {
    state = read();
  }

  return {
    get state() { return state; },
    storageKey, waiverVersion, waiverText, tool, patron, hold, activeLoans, activeHolds, expire, now, advanceHours, reset, reload,
    placeHold, extendHold, extensionReason, verify, signWaiver, validateSelection, checkout, dueAt,
    previewReturn, returnTool, markLost, resolveLoss, saveTool, saveRestrictions
  };
})();
