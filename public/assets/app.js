const CONFIG = {
  factionId: 53295,
  discordInvite: 'https://discord.gg/duHJkWRRT',
  tornStats: 'https://www.tornstats.com/factions/53295',
  refreshMs: 300000,
  requestTimeoutMs: 15000
};

const $ = s => document.querySelector(s);

const fmt = n =>
  n == null || n === '' || Number.isNaN(Number(n))
    ? '—'
    : Number(n).toLocaleString();

const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[c]));

let DATA = {};

const tornUrl =
  `https://www.torn.com/factions.php?step=profile&ID=${CONFIG.factionId}`;

const pdaUrl =
  `tornpda://factions.php?step=profile&ID=${CONFIG.factionId}`;

function setLinks() {
  ['tornBtn', 'heroTorn'].forEach(id => {
    const el = $('#' + id);
    if (el) el.href = tornUrl;
  });

  ['pdaBtn', 'heroPda'].forEach(id => {
    const el = $('#' + id);
    if (el) el.href = pdaUrl;
  });

  const discordBtn = $('#discordBtn');
  const heroDiscord = $('#heroDiscord');
  const statsBtn = $('#statsBtn');

  if (discordBtn) discordBtn.href = CONFIG.discordInvite;
  if (heroDiscord) heroDiscord.href = CONFIG.discordInvite;
  if (statsBtn) statsBtn.href = CONFIG.tornStats;
}

function get(o, ...paths) {
  for (const p of paths) {
    const v = p.split('.').reduce((a, k) => a?.[k], o);

    if (v !== undefined && v !== null) {
      return v;
    }
  }

  return undefined;
}

function arr(v) {
  if (Array.isArray(v)) return v;

  if (v && typeof v === 'object') {
    return Object.values(v);
  }

  return [];
}

function fmtTime(v) {
  if (v == null || v === '') return '—';

  if (typeof v === 'number') {
    try {
      return new Date(v * 1000).toLocaleString();
    } catch (_) {}
  }

  return String(v);
}

function stateCount(ms) {
  return ms.filter(m => {
    const s = String(
      get(m, 'status.state', 'status', 'state') || ''
    ).toLowerCase();

    return ['online', 'okay', 'active'].includes(s);
  }).length;
}

/* =========================
   CHAIN
========================= */

function chainState(ch) {
  const current =
    Number(get(ch, 'current', 'current_chain', 'chain')) || 0;

  const max =
    Number(get(ch, 'max', 'max_chain')) || 0;

  const timeout =
    Number(get(ch, 'timeout', 'chain.timeout')) || 0;

  const cooldownRaw =
    get(ch, 'cooldown', 'chain.cooldown');

  const cooldown =
    Number(cooldownRaw) || 0;

  const now =
    Math.floor(Date.now() / 1000);

  const cooldownRemaining =
    cooldown > now ? cooldown - now : 0;

  return {
    current,
    max,
    timeout,
    cooldown,
    cooldownRemaining
  };
}

function formatDuration(seconds) {
  let n =
    Math.max(0, Math.floor(Number(seconds) || 0));

  const d = Math.floor(n / 86400);
  n %= 86400;

  const h = Math.floor(n / 3600);
  n %= 3600;

  const m = Math.floor(n / 60);
  const s = n % 60;

  const parts = [];

  if (d) parts.push(`${d}d`);
  if (h || d) parts.push(`${h}h`);
  if (m || h || d) parts.push(`${m}m`);

  parts.push(`${s}s`);

  return parts.join(' ');
}

function nextChainMilestone(current) {
  const milestones = [
    10,
    25,
    50,
    100,
    250,
    500,
    1000,
    2500,
    5000,
    10000,
    25000,
    50000,
    100000
  ];

  return milestones.find(n => n > current) || null;
}

function renderChain(ch) {
  const state = chainState(ch);

  const next =
    nextChainMilestone(state.current);

  const live =
    state.timeout > 0;

  const cooldown =
    state.cooldownRemaining > 0;

  const phase =
    cooldown
      ? 'COOLDOWN'
      : live
        ? 'ACTIVE'
        : 'WAITING';

  const phaseEl = $('#chainPhase');
  const bigEl = $('#chainBig');
  const barEl = $('#chainBar');
  const timeoutEl = $('#chainTimeout');
  const cooldownEl = $('#chainCooldown');
  const detailsEl = $('#chainDetails');

  if (phaseEl) {
    phaseEl.textContent = phase;
    phaseEl.className =
      `chain-phase ${phase.toLowerCase()}`;
  }

  if (bigEl) {
    bigEl.textContent =
      fmt(state.current);
  }

  if (barEl) {
    barEl.style.width =
      (
        state.max
          ? Math.min(
              100,
              state.current / state.max * 100
            )
          : 0
      ) + '%';
  }

  if (timeoutEl) {
    timeoutEl.textContent =
      live
        ? `Next hit ${formatDuration(state.timeout)}`
        : 'Next hit —';
  }

  if (cooldownEl) {
    cooldownEl.textContent =
      cooldown
        ? `Cooldown ${formatDuration(state.cooldownRemaining)}`
        : 'Cooldown —';
  }

  const rows = [
    ['Current chain', fmt(state.current)],
    [
      'Chain target',
      state.max ? fmt(state.max) : '—'
    ],
    [
      'Next bonus hit',
      next ? fmt(next) : 'Maximum reached'
    ],
    [
      'Progress',
      state.max
        ? `${Math.min(
            100,
            state.current / state.max * 100
          ).toFixed(1)}%`
        : '—'
    ],
    [
      'Timeout',
      live ? formatDuration(state.timeout) : '—'
    ],
    [
      'Cooldown',
      cooldown
        ? formatDuration(state.cooldownRemaining)
        : '—'
    ],
    [
      'Chain ID',
      get(ch, 'id') ?? '—'
    ],
    [
      'Modifier',
      get(ch, 'modifier') ?? '—'
    ]
  ];

  if (detailsEl) {
    detailsEl.innerHTML =
      rows.map(x =>
        `<div class="list-row">
          <span>${esc(x[0])}</span>
          <b>${esc(x[1])}</b>
        </div>`
      ).join('');
  }
}

/* =========================
   MAIN RENDER
========================= */

function render(d) {
  DATA = d;

  const b = d.basic || {};

  const ms =
    arr(d.members?.members || d.members);

  const cs =
    arr(d.crimes?.crimes || d.crimes);

  const ar =
    arr(d.armory?.items || d.armory);

  const ch =
    d.chain || {};

  const name =
    b.name || 'ORANGE';

  const factionName = $('#factionName');
  const heroTitle = $('#heroTitle');
  const heroSub = $('#heroSub');

  if (factionName) {
    factionName.textContent = name;
  }

  if (heroTitle) {
    heroTitle.textContent = name;
  }

  if (heroSub) {
    heroSub.textContent =
      `Faction #${CONFIG.factionId} • Command intelligence synchronized from database`;
  }

  const respect =
    get(b, 'respect', 'respect_value');

  const membersCount =
    get(
      b,
      'members.member_count',
      'member_count'
    ) ?? ms.length;

  const cap =
    get(
      b,
      'capacity',
      'member_capacity',
      'members.member_capacity'
    );

  const rank =
    get(b, 'rank', 'rankedwar.rank');

  const chainNow =
    Number(
      get(
        ch,
        'current',
        'current_chain',
        'chain'
      )
    ) || 0;

  const respectEl = $('#respect');
  const membersCountEl = $('#membersCount');
  const capacityEl = $('#capacitySmall');
  const rankEl = $('#rank');
  const chainEl = $('#chain');
  const chainBigEl = $('#chainBig');
  const ocCountEl = $('#ocCount');
  const onlineCountEl = $('#onlineCount');

  if (respectEl) {
    respectEl.textContent =
      fmt(respect);
  }

  if (membersCountEl) {
    membersCountEl.textContent =
      fmt(membersCount);
  }

  if (capacityEl) {
    capacityEl.textContent =
      `Capacity ${fmt(cap)}`;
  }

  if (rankEl) {
    rankEl.textContent =
      rank || '—';
  }

  if (chainEl) {
    chainEl.textContent =
      fmt(chainNow);
  }

  if (chainBigEl) {
    chainBigEl.textContent =
      fmt(chainNow);
  }

  if (ocCountEl) {
    ocCountEl.textContent =
      fmt(cs.length);
  }

  if (onlineCountEl) {
    onlineCountEl.textContent =
      fmt(stateCount(ms));
  }

  const now =
    new Date().toLocaleTimeString();

  const updatedEl = $('#updated');
  const footerUpdatedEl = $('#footerUpdated');
  const feedTimeEl = $('#feedTime');

  if (updatedEl) {
    updatedEl.textContent = now;
  }

  if (footerUpdatedEl) {
    footerUpdatedEl.textContent = now;
  }

  if (feedTimeEl) {
    feedTimeEl.textContent = now;
  }

  const info = [
    ['Faction ID', CONFIG.factionId],
    [
      'Leader',
      get(b, 'leader.name', 'leader')
    ],
    ['Respect', fmt(respect)],
    ['Rank', get(b, 'rank')],
    [
      'Age',
      fmtTime(get(b, 'age', 'created'))
    ],
    [
      'Members',
      `${ms.length}${cap ? ` / ${cap}` : ''}`
    ]
  ];

  const factionInfo = $('#factionInfo');

  if (factionInfo) {
    factionInfo.innerHTML =
      info.map(x =>
        `<div>
          <span>${esc(x[0])}</span>
          <b>${esc(x[1])}</b>
        </div>`
      ).join('');
  }

  renderChain(ch);

  const readiness =
    Math.min(
      100,
      Math.round(
        (
          ms.length
            ? Math.min(
                1,
                stateCount(ms) /
                Math.max(1, ms.length)
              ) * 40
            : 8
        )
        +
        Math.min(
          1,
          chainNow / 100
        ) * 40
        +
        (d.rankedwar ? 20 : 0)
      )
    );

  const readinessEl = $('#readiness');
  const readinessTitleEl = $('#readinessTitle');
  const readinessTextEl = $('#readinessText');

  if (readinessEl) {
    readinessEl.textContent =
      readiness + '%';
  }

  if (readinessTitleEl) {
    readinessTitleEl.textContent =
      readiness >= 75
        ? 'Combat ready'
        : readiness >= 45
          ? 'Operational'
          : 'Standby';
  }

  if (readinessTextEl) {
    readinessTextEl.textContent =
      `${ms.length} members tracked • ${cs.length} OC records • ${
        d.rankedwar
          ? 'war data available'
          : 'no active war data returned'
      }`;
  }

  const liveInfo = $('#liveInfo');

  if (liveInfo) {
    liveInfo.innerHTML = [
      [
        'Roster',
        `${ms.length} members / ${stateCount(ms)} active`
      ],
      [
        'Organized crimes',
        cs.length
      ],
      [
        'Armory records',
        ar.length
      ],
      [
        'Ranked war',
        d.rankedwar
          ? 'Available'
          : 'Unavailable'
      ],
      [
        'Territory',
        d.territory
          ? 'Available'
          : 'Unavailable'
      ],
      [
        'Partial feeds',
        d._meta?.partial_failures?.length || 0
      ]
    ].map(x =>
      `<div class="feed-row">
        <span>${esc(x[0])}</span>
        <b>${esc(x[1])}</b>
      </div>`
    ).join('');
  }

  const keys = [
    'basic',
    'members',
    'chain',
    'crimes',
    'rankedwar',
    'territory',
    'upgrades',
    'positions',
    'applications',
    'reports',
    'armory',
    'attacks',
    'revives',
    'contributors',
    'donations'
  ];

  const coverage = $('#coverage');
  const coverageInfo = $('#coverageInfo');

  if (coverage) {
    coverage.textContent =
      `${keys.filter(k => d[k]).length}/${keys.length}`;
  }

  if (coverageInfo) {
    coverageInfo.innerHTML =
      keys.map(k =>
        `<div class="coverage-row">
          <span>${esc(k)}</span>
          <i class="${d[k] ? 'ok' : 'no'}">
            ${d[k] ? '●' : '○'}
          </i>
        </div>`
      ).join('');
  }

  renderMembers(ms);
  renderCrimes(cs);
  renderArmory(ar);
  renderWar(d.rankedwar || {});
  renderTerritory(d.territory || {});
  renderUpgrades(
    arr(d.upgrades?.upgrades || d.upgrades)
  );

  renderGeneric(
    'applicationsInfo',
    d.applications
  );

  renderGeneric(
    'reportsInfo',
    d.reports
  );

  renderGeneric(
    'attacksInfo',
    d.attacks
  );

  renderGeneric(
    'revivesInfo',
    d.revives
  );

  renderGeneric(
    'contributorsInfo',
    d.contributors
  );

  renderGeneric(
    'donationsInfo',
    d.donations
  );
}

/* =========================
   MEMBERS
========================= */

function memberLife(m) {
  const cur =
    get(
      m,
      'life.current',
      'life.current_life',
      'life.value'
    );

  const max =
    get(
      m,
      'life.maximum',
      'life.max',
      'life.max_life'
    );

  if (cur == null && max == null) {
    return '—';
  }

  if (cur != null && max != null) {
    return `${fmt(cur)} / ${fmt(max)}`;
  }

  return fmt(cur ?? max);
}

function memberStatus(m) {
  return String(
    get(
      m,
      'status.state',
      'status',
      'state'
    ) || '—'
  );
}

function renderMembers(ms) {
  const q =
    ($('#memberSearch')?.value || '')
      .toLowerCase();

  const rows =
    ms.filter(m =>
      JSON.stringify(m)
        .toLowerCase()
        .includes(q)
    );

  const table = $('#membersTable');

  if (!table) return;

  table.innerHTML =
    rows.map(m => {
      const status =
        memberStatus(m);

      const last =
        get(
          m,
          'last_action.relative',
          'last_action.timestamp',
          'last_action'
        ) || '—';

      const cls =
        status
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-');

      return `
        <tr>
          <td>
            <a
              href="https://www.torn.com/profiles.php?XID=${encodeURIComponent(m.id)}"
              target="_blank"
              rel="noopener"
            >
              ${esc(m.name || m.username || m.id)}
            </a>
          </td>
          <td>${esc(m.level ?? '—')}</td>
          <td>
            ${esc(
              get(
                m,
                'position.name',
                'position',
                'role'
              ) || '—'
            )}
          </td>
          <td>${esc(memberLife(m))}</td>
          <td>${esc(last)}</td>
          <td>
            <span class="pill status-${esc(cls)}">
              ${esc(status)}
            </span>
          </td>
        </tr>
      `;
    }).join('') ||
    '<tr><td colspan="6">No member data returned.</td></tr>';
}

/* =========================
   ORGANIZED CRIMES
========================= */

function renderCrimes(cs) {
  const note = $('#ocNote');
  const table = $('#crimesTable');

  if (note) {
    note.textContent =
      `${cs.length} records`;
  }

  if (!table) return;

  table.innerHTML =
    cs.slice(0, 150).map(c =>
      `<tr>
        <td>${esc(
          c.name ||
          c.crime_name ||
          c.id ||
          'OC'
        )}</td>
        <td>
          <span class="pill">
            ${esc(
              c.status ||
              c.state ||
              '—'
            )}
          </span>
        </td>
        <td>${esc(
          fmtTime(
            c.created_at ||
            c.created
          )
        )}</td>
        <td>${fmt(
          arr(
            c.participants ||
            c.slots
          ).length
        )}</td>
        <td>${esc(
          c.difficulty ||
          c.success ||
          '—'
        )}</td>
      </tr>`
    ).join('') ||
    '<tr><td colspan="5">No OC data returned. The API key may not have the required faction selection.</td></tr>';
}

/* =========================
   ARMORY
========================= */

function renderArmory(items) {
  const q =
    ($('#armorySearch')?.value || '')
      .toLowerCase();

  const table = $('#armoryTable');

  if (!table) return;

  table.innerHTML =
    items
      .filter(i =>
        JSON.stringify(i)
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 300)
      .map(i =>
        `<tr>
          <td>${esc(
            i.name ||
            i.item_name ||
            i.id ||
            'Item'
          )}</td>
          <td>${esc(
            i.type ||
            i.category ||
            '—'
          )}</td>
          <td>${fmt(
            i.quantity ??
            i.qty ??
            i.amount
          )}</td>
          <td>${esc(
            i.id ?? '—'
          )}</td>
        </tr>`
      ).join('') ||
    '<tr><td colspan="4">Armory inventory is unavailable from this API selection.</td></tr>';
}

/* =========================
   WAR
========================= */

function renderWar(w) {
  const r =
    get(
      w,
      'war',
      'current',
      'rankedwar'
    ) || w;

  const entries =
    Object.entries(r || {})
      .filter(
        ([, v]) =>
          typeof v !== 'object'
      )
      .slice(0, 24);

  const badge = $('#warBadge');
  const info = $('#warInfo');

  if (badge) {
    badge.textContent =
      r && Object.keys(r).length
        ? 'DATA'
        : 'NO ACTIVE DATA';
  }

  if (info) {
    info.innerHTML =
      entries.map(([k, v]) =>
        `<div class="list-row">
          <span>${esc(
            k.replaceAll('_', ' ')
          )}</span>
          <b>${esc(v)}</b>
        </div>`
      ).join('') ||
      '<div class="empty">No ranked-war data returned.</div>';
  }
}

/* =========================
   TERRITORY
========================= */

function renderTerritory(t) {
  const entries =
    Object.entries(t || {})
      .filter(
        ([, v]) =>
          typeof v !== 'object'
      )
      .slice(0, 24);

  const info = $('#territoryInfo');

  if (!info) return;

  info.innerHTML =
    entries.map(([k, v]) =>
      `<div class="list-row">
        <span>${esc(
          k.replaceAll('_', ' ')
        )}</span>
        <b>${esc(v)}</b>
      </div>`
    ).join('') ||
    '<div class="empty">No territory data returned.</div>';
}

/* =========================
   UPGRADES
========================= */

function renderUpgrades(us) {
  const info =
    $('#upgradesInfo');

  if (!info) return;

  info.innerHTML =
    us.map(u =>
      `<div class="upgrade-card">
        <b>${esc(
          u.name ||
          u.upgrade ||
          u.id
        )}</b>
        <span>
          Level ${esc(
            u.level ??
            u.current_level ??
            '—'
          )}
        </span>
      </div>`
    ).join('') ||
    '<div class="empty">No upgrade records returned.</div>';
}

/* =========================
   GENERIC FEEDS
========================= */

function renderGeneric(id, data) {
  const el = $('#' + id);

  if (!el) return;

  const rows = arr(data);

  if (!rows.length) {
    el.innerHTML =
      '<div class="empty">No data returned for this feed.</div>';

    return;
  }

  const sample =
    rows.slice(0, 12);

  const cols =
    [
      ...new Set(
        sample.flatMap(o =>
          typeof o === 'object'
            ? Object.keys(o)
            : ['value']
        )
      )
    ]
      .filter(
        k => !['id'].includes(k)
      )
      .slice(0, 4);

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          ${cols.map(c =>
            `<th>${esc(
              c.replaceAll('_', ' ')
            )}</th>`
          ).join('')}
        </tr>
      </thead>

      <tbody>
        ${sample.map(o =>
          `<tr>
            ${cols.map(c =>
              `<td>${esc(
                typeof o === 'object'
                  ? typeof o[c] === 'object'
                    ? JSON.stringify(o[c])
                    : o[c]
                  : o
              )}</td>`
            ).join('')}
          </tr>`
        ).join('')}
      </tbody>
    </table>
  `;
}

/* =========================
   LOAD DATABASE DATA
========================= */

async function load() {
  const e = $('#error');

  if (e) {
    e.classList.add('hidden');
    e.textContent = '';
  }

  const statusLine =
    $('#statusLine');

  const liveDot =
    $('#liveDot');

  if (statusLine) {
    statusLine.textContent =
      'Connecting…';
  }

  if (liveDot) {
    liveDot.className =
      'sync';
  }

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      CONFIG.requestTimeoutMs
    );

  try {
    const response =
      await fetch(
        `/api/faction?faction_id=${CONFIG.factionId}`,
        {
          cache: 'no-store',
          signal: controller.signal
        }
      );

    clearTimeout(timer);

    let data;

    try {
      data =
        await response.json();
    } catch (_) {
      throw new Error(
        `Server returned invalid JSON (HTTP ${response.status})`
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        `HTTP ${response.status}`
      );
    }

    if (!data || typeof data !== 'object') {
      throw new Error(
        'Database returned an empty response'
      );
    }

    render(data);

    if (statusLine) {
      statusLine.textContent =
        data._meta?.cached
          ? 'Live • database'
          : 'Live • synchronized';
    }

    if (liveDot) {
      liveDot.className = '';
    }

    if (
      data._meta?.partial_failures?.length
    ) {
      if (e) {
        e.textContent =
          `Some Torn feeds were unavailable: ${
            data._meta.partial_failures.join(' • ')
          }`;

        e.classList.remove('hidden');
      }
    }

  } catch (x) {
    clearTimeout(timer);

    let message =
      x?.message ||
      'Unknown connection error';

    if (x?.name === 'AbortError') {
      message =
        'The faction database took too long to respond (15 second timeout).';
    }

    if (e) {
      e.textContent =
        `Could not load faction data: ${message}`;

      e.classList.remove('hidden');
    }

    if (statusLine) {
      statusLine.textContent =
        'Connection failed';
    }

    if (liveDot) {
      liveDot.className =
        'bad';
    }

    console.error(
      'Faction Command Center error:',
      x
    );
  }
}

/* =========================
   START
========================= */

setLinks();

document
  .querySelectorAll('.nav')
  .forEach(button => {
    button.addEventListener(
      'click',
      () => {
        document
          .querySelectorAll(
            '.nav,.tab-panel'
          )
          .forEach(x =>
            x.classList.remove('active')
          );

        button.classList.add('active');

        const panel =
          $('#' + button.dataset.tab);

        if (panel) {
          panel.classList.add('active');
        }

        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    );
  });

const refreshBtn =
  $('#refreshBtn');

if (refreshBtn) {
  refreshBtn.onclick =
    load;
}

const memberSearch =
  $('#memberSearch');

if (memberSearch) {
  memberSearch.addEventListener(
    'input',
    () =>
      renderMembers(
        arr(
          DATA.members?.members ||
          DATA.members
        )
      )
  );
}

const armorySearch =
  $('#armorySearch');

if (armorySearch) {
  armorySearch.addEventListener(
    'input',
    () =>
      renderArmory(
        arr(
          DATA.armory?.items ||
          DATA.armory
        )
      )
  );
}

load();

setInterval(
  load,
  CONFIG.refreshMs
);

setInterval(
  () => {
    if (DATA.chain) {
      renderChain(DATA.chain);
    }
  },
  1000
);
