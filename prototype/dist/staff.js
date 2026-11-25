(() => {
  const e = (value) => escapeHtml(value ?? "");
  const field = (label, control) => `<label class="field"><span>${label}</span>${control}</label>`;
  const check = (name, label, checked = false) =>
    `<label class="check"><input type="checkbox" name="${name}" ${checked ? "checked" : ""}> ${label}</label>`;
  const button = (label, action, value = "", secondary = true) =>
    `<button type="button" class="button ${secondary ? "secondary" : ""}" data-action="${action}" data-value="${e(value)}">${e(label)}</button>`;
  const submit = (label) => `<button type="submit" class="button">${label}</button>`;
  const status = (label) => `<span class="badge ${["Available", "Valid card"].includes(label) ? "available" : ""}">${e(label)}</span>`;
  const option = (value, label, selected) =>
    `<option value="${e(value)}" ${String(value) === String(selected) ? "selected" : ""}>${e(label)}</option>`;
  const select = (name, values, selected) =>
    `<select name="${name}">${values.map((value) => option(value, value, selected)).join("")}</select>`;
  const input = (name, value = "", attributes = "") =>
    `<input name="${name}" value="${e(value)}" ${attributes}>`;
  const textarea = (name, value = "") => `<textarea name="${name}" rows="2">${e(value)}</textarea>`;
  const form = (name, contents) => `<form class="stack" data-form="${name}">${contents}</form>`;
  const panel = (contents) => `<section class="panel stack">${contents}</section>`;
  const table = (headers, rows, empty) => rows.length
    ? `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th scope="col">${header}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
    : `<p class="muted">${empty}</p>`;

  const inventoryStatuses = ["Available", "On hold", "Checked out", "Maintenance", "Retired"];
  let page = "dashboard";
  let patronCard = "";
  let verification = {};
  let selected = [];
  let returnBarcode = "";
  let returnQuery = "";
  let editBarcode = "";
  let inventoryFilters = {};
  let notice = "";
  let receipt = [];

  function heading(title, description = "") {
    return `<div><h1>${e(title)}</h1>${description ? `<p class="muted">${e(description)}</p>` : ""}</div>`;
  }

  function dashboard() {
    const { tools, holds, loans, notifications } = Library.state;
    const activeLoans = loans.filter((loan) => !loan.returnedAt && !loan.lost);
    const readyHolds = holds.filter((hold) => hold.status.toLowerCase() === "active");
    const auditCount = tools.filter((tool) => tool.audit).length;
    return `${heading("Staff workspace", "Manage tool lending, returns, and inventory.")}
      <div class="grid">
        ${panel(`<h2>Checkout</h2><p class="muted">${readyHolds.length} ready for pickup</p>${button("Start checkout", "checkout", "", false)}`)}
        ${panel(`<h2>Returns</h2><p class="muted">${activeLoans.length} tools on loan</p>${button("Process return", "return", "", false)}`)}
        ${panel(`<h2>Patrons</h2><p class="muted">Loans, signed waivers, and borrowing privileges</p>${button("Find patron", "patron")}`)}
        ${panel(`<h2>Inventory</h2><p class="muted">${auditCount} flagged for review</p>${button("Manage inventory", "inventory")}`)}
      </div>
      ${panel(`<h2>Demo clock</h2><p>Current library time <strong>${formatDate(Library.now())}</strong></p>
        <div class="actions">${button("Advance 24 hours", "advance")}${button(`Expiration outbox (${notifications.length})`, "notifications")}</div>`)}`;
  }

  function notifications() {
    const rows = Library.state.notifications.map((entry) =>
      [e(entry.email), e(entry.message), formatDate(entry.createdAt), status(entry.status)]);
    return `${heading("Hold expiration outbox", "Simulated notifications appear here when expired copies are released.")}
      ${panel(table(["Recipient", "Message", "Recorded", "Status"], rows, "No holds have expired."))}`;
  }

  function findPatron() {
    return form("find-patron", `${field("County card number or patron name",
      input("query", patronCard, 'required placeholder="For example, 1001 or Paul"'))}
      <div class="actions">${submit("Look up patron")}</div>`);
  }

  function currentWaiver(patron) {
    return patron.waivers.some((waiver) => waiver.version === Library.waiverVersion);
  }

  function verificationPage() {
    const patron = patronCard && Library.patron(patronCard);
    const holds = patron ? Library.activeHolds(patronCard) : [];
    return `${heading("Start checkout", "Find the patron and verify their eligibility at the desk.")}
      ${panel(findPatron())}
      ${patron ? panel(`<div class="row"><h2>${e(patron.name)}</h2>${status(patron.valid ? "Valid card" : "Invalid card")}</div>
        <p>${Library.activeLoans(patronCard).length} of 5 loans active · ${currentWaiver(patron) ? "Current waiver on file" : "Waiver required"}</p>
        <p>Ready holds · ${holds.map((hold) => e(Library.tool(hold.barcode)?.name)).join(", ") || "None"}</p>
        ${form("verify", `
          ${check("photoId", "Photo ID visually verified", verification.photoId)}
          ${field("Photo ID override reason (if applicable)", textarea("overrideReason", verification.overrideReason))}
          ${check("ageConfirmed", "Age 18 or older confirmed", verification.ageConfirmed)}
          <div class="actions">${submit("Continue checkout")}${button("View patron record", "patron", patronCard)}</div>`)}`) : ""}`;
  }

  function waiverPage() {
    return `${heading("Tool lending waiver", `Version ${Library.waiverVersion} · ${Library.patron(patronCard).name}`)}
      ${panel(`<p>${e(Library.waiverText)}</p>
        ${form("waiver", `
          ${check("accept", "I accept this waiver")}
          ${field("Electronic signature", input("signature", "", "required maxlength=120"))}
          <div class="actions">${submit("Save signature and continue")}${button("Back to verification", "verification")}${button("Decline and end checkout", "dashboard")}</div>`)}`)}`;
  }

  function safetyLink(tool) {
    const url = tool.safety;
    return /^https?:\/\//i.test(url || "") ? `<a href="${e(url)}" target="_blank" rel="noopener">Safety guide</a>` : "";
  }

  function checkoutPage() {
    const patron = Library.patron(patronCard);
    const count = Library.activeLoans(patronCard).length;
    const ready = Library.activeHolds(patronCard).filter((hold) => !selected.includes(hold.barcode));
    const rows = selected.map((barcode) => {
      const tool = Library.tool(barcode);
      return [e(barcode), e(tool.name), tool.status === "On hold" ? "Ready hold" : "Walk-in",
        formatDate(Library.dueAt(barcode)), safetyLink(tool), button("Remove", "remove", barcode)];
    });
    return `${heading(`Checkout for ${patron.name}`, `${count} active loans · ${Math.max(0, 5 - count - selected.length)} remaining slots`)}
      ${panel(`${form("select-copy", `${field("Copy barcode", input("barcode", "", 'required placeholder="For example, T-104"'))}
        <div class="actions">${submit("Add copy")}</div>`)}
        ${ready.length ? `<h2>Ready holds</h2><div class="actions">${ready.map((hold) => button(`Add ${Library.tool(hold.barcode).name}`, "add-copy", hold.barcode)).join("")}</div>` : ""}`)}
      ${panel(`<h2>Selected copies</h2>${table(["Barcode", "Tool", "Source", "Due", "Resources", "Action"], rows, "Add a copy by its barcode or select a ready hold.")}
        ${selected.length ? `<div class="actions">${button("Confirm checkout", "confirm-checkout", "", false)}</div>` : ""}`)}`;
  }

  function receiptPage() {
    return `${heading("Checkout complete", `Receipt for ${Library.patron(patronCard).name}`)}
      ${panel(table(["Barcode", "Tool", "Due", "Resources"], receipt.map((loan) => {
        const tool = Library.tool(loan.barcode);
        return [e(loan.barcode), e(tool.name), formatDate(loan.dueAt), safetyLink(tool)];
      }), "No tools on this receipt."))}
      <div class="actions">${button("Start another checkout", "checkout", "", false)}</div>`;
  }

  function returnPage() {
    const quote = returnBarcode && Library.previewReturn(returnBarcode);
    return `${heading("Return a tool", "Use the library barcode to find the open loan.")}
      ${panel(form("return-lookup", `${field("Copy barcode", input("barcode", returnQuery))}
        <div class="actions">${submit("Look up loan")}</div>`))}
      ${quote ? panel(`<h2>${e(quote.tool.name)} · ${e(quote.tool.barcode)}</h2>
        <p>Borrower <strong>${e(quote.patron.name)}</strong> · Due ${formatDate(quote.loan.dueAt)}</p>
        <p>Grace period ends ${formatDate(quote.graceUntil)} · ${quote.lateDays} billable days · <strong>${money(quote.lateFee)}</strong> late fee</p>
        ${form("return-confirm", `<div class="row">
          ${field("Return condition", select("condition", ["Working", "Damaged", "Broken"], "Working"))}
          ${field("Damage or loss notes", textarea("notes"))}
          </div><div class="actions">${submit("Confirm return")}
          ${quote.loan.dueAt < Library.now() ? '<button type="submit" name="intent" value="lost" class="button secondary">Record as lost</button>' : ""}</div>`)}`) : ""}`;
  }

  function inventoryPage() {
    const { tools } = Library.state;
    const branches = [...new Set(tools.map((tool) => tool.branch))].sort();
    const { query = "", branch = "", status: filterStatus = "", audit = false } = inventoryFilters;
    const matching = tools.filter((tool) => (!audit || tool.audit)
      && (!branch || branch === tool.branch) && (!filterStatus || filterStatus === tool.status)
      && `${tool.name} ${tool.barcode}`.toLowerCase().includes(query.toLowerCase()));
    const rows = matching.map((tool) => [
      e(tool.barcode), e(tool.name), e(tool.branch), status(tool.status),
      tool.audit ? e(tool.notes) || "Needs review" : "—", button("Edit", "edit", tool.barcode),
    ]);
    return `<div class="row">${heading("Tool inventory", "Manage copies, donations, and inventory review.")}
      <div class="actions">${button("Add tool", "edit", "", false)}</div></div>
      ${panel(form("filter-inventory", `<div class="row">
        ${field("Name or barcode", input("query", query))}
        ${field("Location", `<select name="branch">${option("", "All locations", branch)}${branches.map((name) => option(name, name, branch)).join("")}</select>`)}
        ${field("Status", `<select name="status">${option("", "All statuses", filterStatus)}${inventoryStatuses.map((name) => option(name, name, filterStatus)).join("")}</select>`)}
        </div><div class="actions">${check("audit", "Needs audit only", audit)} ${submit("Apply filters")}</div>`))}
      ${panel(table(["Barcode", "Tool", "Location", "Status", "Review notes", "Action"], rows, "No copies match these filters."))}`;
  }

  function editPage() {
    const tool = editBarcode ? Library.tool(editBarcode) : {};
    const locked = ["On hold", "Checked out"].includes(tool.status);
    return `${heading(editBarcode ? `Edit ${tool.name}` : "Add inventory copy",
      editBarcode ? `Barcode ${editBarcode}` : "A unique asset barcode will be assigned on save.")}
      ${panel(form("save-tool", `<div class="grid">
        ${field("Tool name", input("name", tool.name, "required maxlength=100"))}
        ${field("Category", input("category", tool.category, "required maxlength=60"))}
        ${field("Brand / model", input("model", tool.model, "maxlength=100"))}
        ${field("Location", input("branch", tool.branch || "Central Tool Library", "required maxlength=100"))}
        ${field("Acquisition", select("source", ["Purchased", "Donated"], tool.source))}
        ${field("Condition", select("condition", ["Working", "Fair", "Worn", "Damaged", "Broken", ...(tool.condition === "Lost" ? ["Lost"] : [])], tool.condition))}
        ${locked ? `<p>Circulation status <strong>${e(tool.status)}</strong></p>`
          : field("Status", select("status", ["Available", "Maintenance", "Retired"], tool.status))}
        ${field("Loan period (days)", input("days", tool.days ?? 14, 'type="number" max="14" step="any" required'))}
        ${field("Replacement value ($)", input("value", tool.value, 'type="number" min="0" step="0.01" required'))}
        ${field("Late-fee class", `<select name="rate">${option(1, "Standard ($1/day)", tool.rate ?? 1)}${option(3, "High-demand or large ($3/day)", tool.rate)}</select>`)}
        ${field("Safety resource URL", input("safety", tool.safety, 'type="url"'))}
        ${field("Catalog description", textarea("description", tool.description))}
        ${field("Intake, audit, or retirement notes", textarea("notes", tool.notes))}
        </div>
        ${check("donationChecked", "Donation was inspected and found safe to lend", tool.donationChecked)}
        ${check("audit", "Flag for audit", tool.audit)}
        <div class="actions">${submit("Save tool")}${button("Cancel", "inventory", "keep-filters")}</div>`))}`;
  }

  function patronPage() {
    const patron = patronCard && Library.patron(patronCard);
    if (!patron) return `${heading("Find a patron")}${panel(findPatron())}`;
    const { loans, holds, overrides } = Library.state;
    const history = loans.filter((loan) => loan.card === patronCard);
    const patronHolds = holds.filter((hold) => hold.card === patronCard);
    const toolName = (barcode) => Library.tool(barcode)?.name || barcode;
    return `${heading("Patron record")}${panel(findPatron())}
      ${panel(`<div class="row"><h2>${e(patron.name)}</h2>${status(patron.valid ? "Valid card" : "Invalid card")}</div>
        <p>County card ${e(patron.card)} · ${Library.activeLoans(patronCard).length} of 5 tools on loan</p>
        ${form("restrictions", `<h3>Tool borrowing privileges</h3><div class="grid">
          ${field("Concurrent hold limit", input("holdLimit", patron.holdLimit, 'type="number" min="0" step="1" required'))}
          ${field("Minimum days between holds", input("holdInterval", patron.holdInterval, 'type="number" min="0" step="1" required'))}
          ${field("Restriction reason", textarea("reason", patron.reason))}
          </div>${check("blocked", "Restrict tool borrowing", patron.blocked)}
          <div class="actions">${submit("Save restrictions")}</div>`)}`)}
      ${panel(`<h2>Loans and fees</h2>${table(["Tool", "Barcode", "Due", "Status", "Late fee"], history.map((loan) => [
        e(toolName(loan.barcode)), e(loan.barcode), formatDate(loan.dueAt), status(loan.lost ? "Lost" : loan.returnedAt ? "Returned" : "Checked out"), money(loan.lateFee || 0),
      ]), "No loan history.")}`)}
      ${panel(`<h2>Holds</h2>${table(["Tool", "Hold reference", "Pickup deadline", "Status"], patronHolds.map((hold) => [
        e(toolName(hold.barcode)), e(hold.id), formatDate(hold.expiresAt), status(hold.status),
      ]), "No hold history.")}`)}
      ${panel(`<h2>Damage and loss</h2>${table(["Tool", "Incident", "Notes", "Action"], history.filter((loan) => loan.lost || ["Damaged", "Broken"].includes(loan.condition)).map((loan) => [
        e(toolName(loan.barcode)), e(loan.lost ? "Lost" : loan.condition), e(loan.notes),
        loan.lost && !loan.resolved ? button("Resolve loss", "resolve-loss", loan.barcode) : loan.resolved ? "Resolved" : "—",
      ]), "No damage or loss history.")}`)}
      ${panel(`<h2>Signed waivers</h2>${patron.waivers.map((waiver) => `<details>
        <summary>Version ${e(waiver.version)} · Signed ${formatDate(waiver.signedAt)}</summary>
        <p>Signature <strong>${e(waiver.signature)}</strong></p>
        <p>${e(waiver.text)}</p></details>`).join("") || '<p class="muted">No waiver records.</p>'}`)}
      ${panel(`<h2>Photo ID overrides</h2>${table(["Recorded", "Reason"], overrides.filter((entry) => entry.card === patronCard)
        .map((entry) => [formatDate(entry.createdAt), e(entry.reason)]), "No overrides on record.")}`)}`;
  }

  const screens = {
    dashboard, notifications, verify: verificationPage, waiver: waiverPage, checkout: checkoutPage,
    receipt: receiptPage, return: returnPage, inventory: inventoryPage, edit: editPage, patron: patronPage,
  };

  function show(pageName, message = "") {
    const moved = page !== pageName;
    page = pageName;
    notice = message;
    render();
    if (moved) {
      const title = app.querySelector("h1");
      title?.setAttribute("tabindex", "-1");
      title?.focus();
    }
  }

  function startCheckout() {
    patronCard = "";
    verification = {};
    selected = [];
    receipt = [];
    show("verify");
  }

  function addCopy(barcode) {
    const copies = [...selected, barcode.trim().toUpperCase()];
    Library.validateSelection(patronCard, copies);
    selected = copies;
    show("checkout");
    app.querySelector('[name="barcode"]')?.focus();
  }

  const actions = {
    dashboard: () => {
      patronCard = "";
      show("dashboard");
    },
    checkout: startCheckout,
    verification: () => show("verify"),
    return: () => {
      returnBarcode = "";
      returnQuery = "";
      show("return");
    },
    inventory: (value) => {
      if (!value) inventoryFilters = {};
      show("inventory");
    },
    patron: (value) => {
      patronCard = value;
      show("patron");
    },
    edit: (value) => {
      editBarcode = value;
      show("edit");
    },
    advance: () => {
      Library.advanceHours(24);
      show("dashboard", "Advanced the demo clock by 24 hours.");
    },
    notifications: () => show("notifications"),
    "add-copy": addCopy,
    remove: (barcode) => {
      selected = selected.filter((value) => value !== barcode);
      show("checkout");
    },
    "confirm-checkout": () => {
      receipt = Library.checkout(patronCard, selected, verification);
      show("receipt");
    },
    "resolve-loss": (barcode) => {
      Library.resolveLoss(barcode);
      show("patron", "Loss resolution saved.");
    },
  };

  const forms = {
    "find-patron": (data) => {
      const query = data.get("query").trim();
      const exact = Library.patron(query);
      const matches = exact ? [exact] : Library.state.patrons.filter((person) =>
        query && person.name.toLowerCase().includes(query.toLowerCase()));
      if (matches.length > 1) throw new Error("Multiple patrons match. Enter the full name or county card number.");
      const [patron] = matches;
      if (!patron) throw new Error("No patron matched that name or card number.");
      patronCard = patron.card;
      verification = {};
      show(page);
    },
    verify: (data) => {
      const details = {
        photoId: data.has("photoId"),
        ageConfirmed: data.has("ageConfirmed"),
        overrideReason: data.get("overrideReason"),
      };
      Library.verify(patronCard, details);
      verification = details;
      show(currentWaiver(Library.patron(patronCard)) ? "checkout" : "waiver");
    },
    waiver: (data) => {
      if (!data.has("accept")) throw new Error("Accept the waiver before saving the signature.");
      Library.signWaiver(patronCard, data.get("signature"));
      show("checkout");
    },
    "select-copy": (data) => addCopy(data.get("barcode")),
    "return-lookup": (data) => {
      returnQuery = data.get("barcode").trim().toUpperCase();
      returnBarcode = "";
      try {
        returnBarcode = Library.previewReturn(returnQuery).tool.barcode;
      } catch (error) {
        show("return");
        throw error;
      }
      show("return");
    },
    "return-confirm": (data, intent) => {
      if (intent === "lost") {
        Library.markLost(returnBarcode, data.get("notes"));
        const message = `${returnBarcode} recorded as lost.`;
        returnBarcode = "";
        returnQuery = "";
        show("return", message);
        return;
      }
      const loan = Library.returnTool(returnBarcode, {
        condition: data.get("condition"),
        notes: data.get("notes"),
      });
      returnBarcode = "";
      returnQuery = "";
      show("return", `Return complete. Late fee ${money(loan.lateFee)}.`);
    },
    "filter-inventory": (data) => {
      inventoryFilters = Object.fromEntries(data);
      show("inventory");
    },
    "save-tool": (data) => {
      const fields = Object.fromEntries(data);
      fields.audit = data.has("audit");
      fields.donationChecked = data.has("donationChecked");
      const tool = Library.saveTool(fields, editBarcode || undefined);
      show("inventory", `Saved ${tool.name} · ${tool.barcode}.`);
    },
    restrictions: (data) => {
      Library.saveRestrictions(patronCard, {
        holdLimit: Number(data.get("holdLimit")),
        holdInterval: Number(data.get("holdInterval")),
        blocked: data.has("blocked"),
        reason: data.get("reason"),
      });
      show("patron", "Borrowing privileges saved.");
    },
  };

  function run(action) {
    try {
      action();
    } catch (error) {
      const alert = app.querySelector("#staff-error");
      alert.textContent = error.message;
      alert.hidden = false;
      alert.focus();
    }
  }

  function render() {
    app.innerHTML = `<div class="staff-workspace stack">
      <nav class="actions" aria-label="Staff navigation">
        ${button("Dashboard", "dashboard")}${button("Checkout", "checkout")}
        ${button("Returns", "return")}${button("Inventory", "inventory")}${button("Patrons", "patron")}
      </nav>
      <p role="alert" class="error" id="staff-error" tabindex="-1" hidden></p>
      ${notice ? `<p class="success" role="status">${e(notice)}</p>` : ""}
      ${screens[page]()}
    </div>`;
    const workspace = app.querySelector(".staff-workspace");
    workspace.addEventListener("click", (event) => {
      const target = event.target.closest("[data-action]");
      if (target) run(() => actions[target.dataset.action](target.dataset.value));
    });
    workspace.addEventListener("submit", (event) => {
      event.preventDefault();
      run(() => forms[event.target.dataset.form](new FormData(event.target), event.submitter?.value));
    });
  }

  window.renderStaff = render;
})();
