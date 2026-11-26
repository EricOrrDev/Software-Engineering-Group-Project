const app = document.querySelector('main')
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character])
const formatDate = timestamp => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium', timeStyle: 'short'
}).format(new Date(timestamp))
const money = amount => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD'
}).format(amount)

const filters = { search: '', category: '', branch: '', available: false }
const catalogLink = '<a href="#catalog">Back to catalog</a>'

function statusBadge(status) {
  return '<span class="badge ' + (status === 'Available' ? 'available' : '') + '">' + escapeHtml(status) + '</span>'
}

function options(values, first) {
  return '<option value="">' + first + '</option>' + [...new Set(values)].sort().map(value =>
    '<option>' + escapeHtml(value) + '</option>').join('')
}

function renderCatalog() {
  const tools = Library.state.tools.filter(tool => tool.status !== 'Retired')
  app.innerHTML = `
    <section class="hero">
      <p class="eyebrow">County Library · Tool lending</p>
      <h1>Find your next tool.</h1>
      <p>Browse the collection and reserve a tool for pickup with your county library card.</p>
    </section>
    <section aria-labelledby="collection">
      <div class="catalog-header"><h2 id="collection">Tool catalog</h2><p id="result-count" class="muted" aria-live="polite"></p></div>
      <form id="filters" class="panel filters">
        <label>Search tools<input name="search" type="search" placeholder="Try “hedge trimmer”"></label>
        <label>Category<select name="category">${options(tools.map(tool => tool.category), 'All categories')}</select></label>
        <label>Location<select name="branch">${options(tools.map(tool => tool.branch), 'All locations')}</select></label>
        <label class="check"><input name="available" type="checkbox"> Available now</label>
      </form>
      <div id="results" class="grid"></div>
    </section>`
  const form = app.querySelector('#filters')
  for (const name of ['search', 'category', 'branch']) form.elements[name].value = filters[name]
  form.elements.available.checked = filters.available
  function updateResults() {
    for (const name of ['search', 'category', 'branch']) filters[name] = form.elements[name].value
    filters.available = form.elements.available.checked
    const query = filters.search.trim().toLowerCase()
    const matches = tools.filter(tool =>
      [tool.name, tool.category, tool.model, tool.barcode].some(value => String(value ?? '').toLowerCase().includes(query)) &&
      (!filters.category || tool.category === filters.category) &&
      (!filters.branch || tool.branch === filters.branch) &&
      (!filters.available || tool.status === 'Available'))
    app.querySelector('#result-count').textContent = matches.length + (matches.length === 1 ? ' tool' : ' tools')
    app.querySelector('#results').innerHTML = matches.map(tool => `
      <article class="panel tool-card">
        <div class="card-top"><span class="muted">${escapeHtml(tool.category)}</span>${statusBadge(tool.status)}</div>
        <h3>${escapeHtml(tool.name)}</h3>
        <p>${escapeHtml(tool.description || tool.model || tool.category)}</p>
        <p class="muted">${escapeHtml(tool.branch)} · ${tool.days} day loan</p>
        <a href="#tool/${encodeURIComponent(tool.barcode)}" aria-label="View details for ${escapeHtml(tool.name)}">View details</a>
      </article>`).join('') || '<p class="panel">No tools match. Try a different search or change the filters.</p>'
  }
  form.addEventListener('input', updateResults)
  form.addEventListener('submit', event => event.preventDefault())
  updateResults()
}

function renderTool(barcode) {
  const tool = Library.tool(barcode)
  if (!tool || tool.status === 'Retired') return renderMissing('This tool is no longer listed.')
  const onLoan = Library.state.loans.find(loan => loan.barcode === tool.barcode && !loan.returnedAt && !loan.lost)
  const safety = typeof tool.safety === 'string' && /^https?:\/\//i.test(tool.safety.trim())
    ? '<a href="' + escapeHtml(tool.safety.trim()) + '" target="_blank" rel="noopener noreferrer">Open safety guide</a>'
    : escapeHtml(tool.safetyNote || 'Ask staff about safety resources when you pick up the tool.')
  app.innerHTML = `
    <div class="stack narrow">
      <div>${catalogLink}</div>
      <section class="panel">
        <p class="eyebrow">${escapeHtml(tool.category)}</p>
        <h1>${escapeHtml(tool.name)}</h1>
        <p>${statusBadge(tool.status)} · ${escapeHtml(tool.branch)}</p>
        <p>${escapeHtml(tool.description || tool.model || tool.category)}</p>
        <p><strong>Loan period</strong> · ${tool.days} days</p>
        ${onLoan?.dueAt ? '<p><strong>Expected return</strong> · ' + formatDate(onLoan.dueAt) + '</p>' : ''}
        <h2>Safety resources</h2><p>${safety}</p>
        ${tool.status === 'Available' ? '<a class="button" href="#reserve/' + encodeURIComponent(barcode) + '">Place a hold</a>' : '<p>Holds open when this copy becomes available.</p>'}
      </section>
    </div>`
}

function renderMissing(message) {
  app.innerHTML = '<div class="panel narrow"><h1>Item unavailable</h1><p>' + escapeHtml(message) + '</p>' + catalogLink + '</div>'
}

function renderReserve(barcode) {
  const tool = Library.tool(barcode)
  if (!tool || tool.status !== 'Available') return renderMissing('This copy is currently unavailable for holds.')
  app.innerHTML = `
    <div class="stack narrow">
      <div><a href="#tool/${encodeURIComponent(barcode)}">Back to tool details</a></div>
      <section class="panel">
        <p class="eyebrow">Place a hold</p><h1>${escapeHtml(tool.name)}</h1>
        <p>Pick up at ${escapeHtml(tool.branch)} within 24 hours.</p>
        <form id="reserve" class="stack">
          <label>Library card number<input name="card" required inputmode="numeric" autocomplete="off" aria-describedby="demo-card"></label>
          <small id="demo-card">Try demo card 1001 (Paul) or 1002 (Saul).</small>
          <div class="error" role="alert"></div>
          <div><button>Confirm hold</button></div>
        </form>
      </section>
    </div>`
  app.querySelector('form').addEventListener('submit', event => {
    event.preventDefault()
    try {
      const hold = Library.placeHold(barcode, event.currentTarget.elements.card.value.trim())
      location.hash = '#hold/' + encodeURIComponent(hold.id)
    } catch (error) {
      app.querySelector('[role=alert]').textContent = error.message
    }
  })
}

function renderHoldLookup() {
  app.innerHTML = `
    <section class="panel narrow">
      <h1>View a hold</h1>
      <p>Enter the reference from your hold confirmation.</p>
      <form class="stack">
        <label>Hold reference<input name="reference" required autocomplete="off"></label>
        <div class="error" role="alert"></div>
        <div><button>Find hold</button></div>
      </form>
    </section>`
  app.querySelector('form').addEventListener('submit', event => {
    event.preventDefault()
    const hold = Library.hold(event.currentTarget.elements.reference.value.trim())
    if (hold) location.hash = '#hold/' + encodeURIComponent(hold.id)
    else app.querySelector('[role=alert]').textContent = 'Hold reference not found. Check the confirmation and try again.'
  })
}

function renderHold(id, message = '') {
  const hold = Library.hold(id)
  if (!hold) return renderMissing('That hold reference could not be found.')
  const tool = Library.tool(hold.barcode)
  const active = hold.status === 'Active'
  const ineligible = Library.extensionReason(id)
  app.innerHTML = `
    <div class="stack narrow">
      <div>${catalogLink}</div>
      <section class="panel">
        <p class="eyebrow">Hold details</p><h1>${escapeHtml(tool.name)}</h1>
        <p>${statusBadge(active ? 'Ready for pickup' : hold.status)}</p>
        <p><strong>Hold reference</strong> · ${escapeHtml(hold.id)}</p>
        <p><strong>Pickup deadline</strong> · ${formatDate(hold.expiresAt)}</p>
        <p><strong>Pickup location</strong> · ${escapeHtml(hold.branch || tool.branch)}</p>
        ${active ? '<p>Bring your county library card and photo ID.</p>' : ''}
        ${message ? '<p class="success" role="status">' + escapeHtml(message) + '</p>' : ''}
        ${active && ineligible ? '<p class="notice">' + escapeHtml(ineligible) + '</p>' : ''}
        ${active && !ineligible ? '<button id="extend">Extend by 24 hours</button>' : ''}
        <div class="error" role="alert"></div>
      </section>
    </div>`
  app.querySelector('#extend')?.addEventListener('click', () => {
    try {
      Library.extendHold(id)
      renderHold(id, 'Your pickup deadline was extended by 24 hours.')
      app.querySelector('h1')?.setAttribute('tabindex', '-1')
      app.querySelector('h1')?.focus()
    } catch (error) {
      app.querySelector('[role=alert]').textContent = error.message
    }
  })
}

function renderPage(focus = false) {
  if (!Library.state) return
  Library.expire()
  const [page, reference] = location.hash.slice(1).split('/')
  let id
  try { id = decodeURIComponent(reference ?? '') }
  catch { return renderMissing('The link is invalid.') }
  const navSection = page === 'staff' ? 'staff' : ['hold', 'holds'].includes(page) ? 'holds' : 'catalog'
  document.querySelectorAll('nav a').forEach(link => {
    if (link.hash === '#' + navSection) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })
  switch (page) {
    case 'staff': window.renderStaff(); break
    case 'tool': renderTool(id); break
    case 'reserve': renderReserve(id); break
    case 'holds': renderHoldLookup(); break
    case 'hold': renderHold(id); break
    default: renderCatalog()
  }
  if (focus) app.focus()
}

window.addEventListener('hashchange', () => renderPage(true))
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault()
  app.focus()
})
window.addEventListener('storage', event => {
  if ((event.key === Library.storageKey || event.key === null) && Library.state) {
    Library.reload()
    if (!location.hash.startsWith('#staff')) renderPage()
  }
})
let refreshPending = false
window.setInterval(() => {
  if (!Library.state) return
  refreshPending = Boolean(Library.expire()) || refreshPending
  const editing = document.activeElement?.matches('input, select, textarea, button')
  if (refreshPending && !location.hash.startsWith('#staff') && !editing) {
    refreshPending = false
    renderPage()
  }
}, 30_000)
Library.init()
  .then(() => renderPage())
  .catch(error => {
    app.innerHTML = `<div class="panel narrow"><h1>Unable to load prototype data</h1><p>${escapeHtml(error.message)}</p><p class="muted">Serve <code>prototype/dist</code> over HTTP (for example, <code>python -m http.server 8000 --directory prototype/dist</code>) rather than opening <code>index.html</code> directly from disk.</p></div>`
  })
