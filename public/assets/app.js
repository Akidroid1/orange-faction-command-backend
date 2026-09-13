const CONFIG = {
  factionId: 53295,
  discordInvite: 'https://discord.gg/duHJkWRRT',
  tornStats: 'https://www.tornstats.com/factions/53295',
  refreshMs: 300000,
  chainRefreshMs: 5000
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
let liveChainTimer = null;

const tornUrl =
  `https://www.torn.com/factions.php?step=profile&ID=${CONFIG.factionId}`;

const pdaUrl =
  `tornpda://factions.php?step=profile&ID=${CONFIG.factionId}`;

function get(o, ...paths) {
  for (const p of paths) {
    const v = p.split('.').reduce((a, k) => a?.[k], o);
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function arr(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return Object.values(v);
  return [];
}

function scalar(v, fallback = '—') {
  if (v == null || v === '') return fallback;

  if (typeof v === 'object') {
    return (
      v.name ??
      v.username ??
      v.title ??
      v.rank ??
      v.label ??
      v.value ??
      v.id ??
      fallback
    );
  }

  return v;
}

function fmtTime(v) {
  if (v == null || v === '') return '—';

  const n = Number(v);

  if (!Number.isNaN(n)) {
    const ms = n < 100000000000 ? n * 1000 : n;
    const d = new Date(ms);

    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString();
    }
  }

  return String(v);
}

function factionAge(b) {
  const age = get(
    b,
    'age',
    'age_days',
    'days_old',
    'faction_age'
  );

  if (typeof age === 'number') {
    if (age >= 365) {
      return `${Math.floor(age / 365)}y ${Math.floor((age % 365) / 30)}m`;
    }

    if (age >= 30) {
      return `${Math.floor(age / 30)}m`;
    }

    return `${age}d`;
  }

  const created = get(
    b,
    'created',
    'created_at',
    'creation_date',
    'founded'
  );

  const n = Number(created);

  if (!Number.isNaN(n) && n > 0) {
    const createdMs = n < 100000000000 ? n * 1000 : n;
    const days = Math.max(
      0,
      Math.floor((Date.now() - createdMs) / 86400000)
    );

    if (days >= 365) {
      return `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}m`;
    }

    if (days >= 30) {
      return `${Math.floor(days / 30)}m`;
    }

    return `${days}d`;
  }

  return scalar(age);
}

function leaderName(b) {
  const leader = get(
    b,
    'leader',
    'leader_id',
    'leader_name'
  );

  return scalar(
    leader,
    '—'
  );
}

function factionRank(b) {
  const rank = get(
    b,
    'rank',
    'faction_rank',
    'rankedwar.rank',
    'ranked_war.rank'
  );

  return scalar(rank);
}

function stateCount(ms) {
  return ms.filter(m => {
    const s = String(
      get(
        m,
        'status.state',
        'status',
        'state'
      ) || ''
    ).toLowerCase();

    return [
      'online',
      'okay',
      'active'
    ].includes(s);
  }).length;
}

function setLinks() {
  ['tornBtn', 'heroTorn'].forEach(id => {
    const el = $('#' + id);
    if (el) el.href = tornUrl;
  });

  ['pdaBtn', 'heroPda'].forEach(id => {
    const el = $('#' + id);
    if (el) el.href = pdaUrl;
  });

  ['discordBtn', 'heroDiscord'].forEach(id => {
    const el = $('#' + id);
    if (el) el.href = CONFIG.discordInvite;
  });

  const stats = $('#statsBtn');
  if (stats) stats.href = CONFIG.tornStats;
}

function chainState(ch) {
  const source =
    get(ch, 'current') && typeof get(ch, 'current') === 'object'
      ? get(ch, 'current')
      : ch;

  const current = Number(
    get(
      source,
      'current',
      'current_chain',
      'chain',
      'hits'
    )
  ) || 0;

  const max = Number(
    get(
      source,
      'max',
      'max_chain',
      'target'
    )
  ) || 0;

  let timeout = Number(
    get(
      source,
      'timeout',
      'chain.timeout',
      'timeout_remaining'
    )
  ) || 0;

  const cooldown = Number(
    get(
      source,
      'cooldown',
      'chain.cooldown'
    )
  ) || 0;

  const now = Math.floor(Date.now() / 1000);

  if (timeout > now && timeout > 1000000000) {
    timeout -= now;
  }

  const cooldownRemaining =
    cooldown > now && cooldown > 1000000000
      ? cooldown - now
      : Math.max(0, cooldown);

  return {
    current,
    max,
    timeout,
    cooldown,
    cooldownRemaining
  };
}

function formatDuration(seconds) {
  let n = Math.max(
    0,
    Math.floor(Number(seconds) || 0)
  );

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
  if (!ch) return;

  const state = chainState(ch);
  const next = nextChainMilestone(state.current);

  const live = state.timeout > 0;
  const cooldown = state.cooldownRemaining > 0;

  const phase =
    cooldown
      ? 'COOLDOWN'
      : live
        ? 'ACTIVE'
        : state.current > 0
          ? 'ACTIVE'
          : 'WAITING';

  const phaseEl = $('#chainPhase');

  if (phaseEl) {
    phaseEl.textContent = phase;
    phaseEl.className =
      `chain-phase ${phase.toLowerCase()}`;
  }

  const big = $('#chainBig');

  if (big) {
    big.textContent = fmt(state.current);
  }

  const bar = $('#chainBar');

  if (bar) {
    bar.style.width =
      (
        state.max
          ? Math.min(
              100,
              state.current / state.max * 100
            )
          : state.current
            ? 100
            : 0
      ) + '%';
  }

  const timeoutEl = $('#chainTimeout');

  if (timeoutEl) {
    timeoutEl.textContent =
      live
        ? `Next hit ${formatDuration(state.timeout)}`
        : 'Next hit —';
  }

  const cooldownEl = $('#chainCooldown');

  if (cooldownEl) {
    cooldownEl.textContent =
      cooldown
        ? `Cooldown ${formatDuration(state.cooldownRemaining)}`
        : 'Cooldown —';
  }

  const details = $('#chainDetails');

  if (details) {
    const rows = [
      [
        'Current chain',
        fmt(state.current)
      ],
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
        scalar(get(ch, 'id'))
      ],
      [
        'Modifier',
        scalar(get(ch, 'modifier'))
      ]
    ];

    details.innerHTML = rows
      .map(
        x =>
          `<div class="list-row">
            <span>${esc(x[0])}</span>
            <b>${esc(x[1])}</b>
          </div>`
      )
      .join('');
  }

  const commandChain = $('#commandChain');
  const oldCommandChain = $('#chain');

  if (commandChain) {
    commandChain.textContent = fmt(state.current);
  } else if (oldCommandChain) {
    oldCommandChain.textContent = fmt(state.current);
  }
}

function render(d) {
  DATA = d || {};

  const b = d.basic || {};

  const ms = arr(
    d.members?.members ||
    d.members
  );

  const cs = arr(
    d.crimes?.crimes ||
    d.crimes
  );

  const ar = arr(
    d.armory?.items ||
    d.armory
  );

  const ch = d.chain || {};

  const name =
    scalar(
      get(b, 'name', 'faction_name'),
      'ORANGE'
    );

  const factionName = $('#factionName');
  if (factionName) factionName.textContent = name;

  const heroTitle = $('#heroTitle');
  if (heroTitle) heroTitle.textContent = name;

  const heroSub = $('#heroSub');
  if (heroSub) {
    heroSub.textContent =
      `Faction #${CONFIG.factionId} • Command intelligence synchronized from Torn`;
  }

  const respect = get(
    b,
    'respect',
    'respect_value'
  );

  const respectEl = $('#respect');
  if (respectEl) {
    respectEl.textContent = fmt(respect);
  }

  const memberCount =
    get(
      b,
      'members.member_count',
      'member_count'
    ) ?? ms.length;

  const membersCount = $('#membersCount');

  if (membersCount) {
    membersCount.textContent =
      fmt(memberCount);
  }

  const cap = get(
    b,
    'capacity',
    'member_capacity',
    'members.member_capacity'
  );

  const capacitySmall = $('#capacitySmall');

  if (capacitySmall) {
    capacitySmall.textContent =
      `Capacity ${fmt(cap)}`;
  }

  const rankEl = $('#rank');

  if (rankEl) {
    rankEl.textContent =
      factionRank(b);
  }

  const state = chainState(ch);

  const chainKpi =
    $('#commandChain') ||
    $('#chain');

  if (chainKpi) {
    chainKpi.textContent =
      fmt(state.current);
  }

  const ocCount = $('#ocCount');

  if (ocCount) {
    ocCount.textContent =
      fmt(cs.length);
  }

  const onlineCount = $('#onlineCount');

  if (onlineCount) {
    onlineCount.textContent =
      fmt(stateCount(ms));
  }

  const now = new Date();
  const time = now.toLocaleTimeString();

  const updated = $('#updated');
  if (updated) updated.textContent = time;

  const footerUpdated = $('#footerUpdated');
  if (footerUpdated) {
    footerUpdated.textContent = time;
  }

  const feedTime = $('#feedTime');
  if (feedTime) {
    feedTime.textContent = time;
  }

  const factionInfo = $('#factionInfo');

  if (factionInfo) {
    const info = [
      [
        'Faction ID',
        CONFIG.factionId
      ],
      [
        'Leader',
        leaderName(b)
      ],
      [
        'Respect',
        fmt(respect)
      ],
      [
        'Rank',
        factionRank(b)
      ],
      [
        'Age',
        factionAge(b)
      ],
      [
        'Members',
        `${ms.length}${cap ? ` / ${fmt(cap)}` : ''}`
      ]
    ];

    factionInfo.innerHTML =
      info
        .map(
          x =>
            `<div>
              <span>${esc(x[0])}</span>
              <b>${esc(x[1])}</b>
            </div>`
        )
        .join('');
  }

  renderChain(ch);

  const readinessEl = $('#readiness');

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
            : 20
        ) +
        (
          state.current
            ? Math.min(
                1,
                state.current / 100
              ) * 40
            : 0
        ) +
        (d.rankedwar ? 20 : 0)
      )
    );

  if (readinessEl) {
    readinessEl.textContent =
      readiness + '%';
  }

  const readinessTitle =
    $('#readinessTitle');

  if (readinessTitle) {
    readinessTitle.textContent =
      readiness >= 75
        ? 'Combat ready'
        : readiness >= 45
          ? 'Operational'
          : 'Standby';
  }

  const readinessText =
    $('#readinessText');

  if (readinessText) {
    readinessText.textContent =
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
    ]
      .map(
        x =>
          `<div class="feed-row">
            <span>${esc(x[0])}</span>
            <b>${esc(x[1])}</b>
          </div>`
      )
      .join('');
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

  if (coverage) {
    coverage.textContent =
      `${keys.filter(k => d[k]).length}/${keys.length}`;
  }

  const coverageInfo =
    $('#coverageInfo');

  if (coverageInfo) {
    coverageInfo.innerHTML =
      keys
        .map(
          k =>
            `<div class="coverage-row">
              <span>${esc(k)}</span>
              <i class="${d[k] ? 'ok' : 'no'}">
                ${d[k] ? '●' : '○'}
              </i>
            </div>`
        )
        .join('');
  }

  renderMembers(ms);
  renderCrimes(cs);
  renderArmory(ar);
  renderWar(d.rankedwar || {});
  renderTerritory(d.territory || {});
  renderUpgrades(
    arr(
      d.upgrades?.upgrades ||
      d.upgrades
    )
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

function memberLife(m) {
  const cur = get(
    m,
    'life.current',
    'life.current_life',
    'life.value'
  );

  const max = get(
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
    rows
      .map(m => {
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
            .replace(
              /[^a-z0-9]+/g,
              '-'
            );

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
      })
      .join('') ||
    '<tr><td colspan="6">No member data returned.</td></tr>';
}

function renderCrimes(cs) {
  const note = $('#ocNote');

  if (note) {
    note.textContent =
      `${cs.length} records`;
  }

  const table =
    $('#crimesTable');

  if (!table) return;

  table.innerHTML =
    cs
      .slice(0, 150)
      .map(
        c =>
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
      )
      .join('') ||
    '<tr><td colspan="5">No OC data returned.</td></tr>';
}

function renderArmory(items) {
  const q =
    ($('#armorySearch')?.value || '')
      .toLowerCase();

  const table =
    $('#armoryTable');

  if (!table) return;

  table.innerHTML =
    items
      .filter(i =>
        JSON.stringify(i)
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 300)
      .map(
        i =>
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
      )
      .join('') ||
    '<tr><td colspan="4">Armory inventory is unavailable.</td></tr>';
}

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

  const badge =
    $('#warBadge');

  if (badge) {
    badge.textContent =
      r &&
      Object.keys(r).length
        ? 'DATA'
        : 'NO ACTIVE DATA';
  }

  const info =
    $('#warInfo');

  if (!info) return;

  info.innerHTML =
    entries
      .map(
        ([k, v]) =>
          `<div class="list-row">
            <span>${esc(
              k.replaceAll('_', ' ')
            )}</span>
            <b>${esc(v)}</b>
          </div>`
      )
      .join('') ||
    '<div class="empty">No ranked-war data returned.</div>';
}

function renderTerritory(t) {
  const entries =
    Object.entries(t || {})
      .filter(
        ([, v]) =>
          typeof v !== 'object'
      )
      .slice(0, 24);

  const info =
    $('#territoryInfo');

  if (!info) return;

  info.innerHTML =
    entries
      .map(
        ([k, v]) =>
          `<div class="list-row">
            <span>${esc(
              k.replaceAll('_', ' ')
            )}</span>
            <b>${esc(v)}</b>
          </div>`
      )
      .join('') ||
    '<div class="empty">No territory data returned.</div>';
}

function renderUpgrades(us) {
  const info =
    $('#upgradesInfo');

  if (!info) return;

  info.innerHTML =
    us
      .map(
        u =>
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
      )
      .join('') ||
    '<div class="empty">No upgrade records returned.</div>';
}

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

  const cols = [
    ...new Set(
      sample.flatMap(o =>
        typeof o === 'object'
          ? Object.keys(o)
          : ['value']
      )
    )
  ]
    .filter(k => k !== 'id')
    .slice(0, 4);

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          ${cols
            .map(
              c =>
                `<th>${esc(
                  c.replaceAll('_', ' ')
                )}</th>`
            )
            .join('')}
        </tr>
      </thead>
      <tbody>
        ${sample
          .map(
            o =>
              `<tr>
                ${cols
                  .map(c => {
                    const value =
                      typeof o === 'object'
                        ? typeof o[c] === 'object'
                          ? JSON.stringify(o[c])
                          : o[c]
                        : o;

                    return `<td>${esc(value)}</td>`;
                  })
                  .join('')}
              </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}

async function load() {
  const e = $('#error');

  if (e) {
    e.classList.add('hidden');
  }

  const statusLine =
    $('#statusLine');

  if (statusLine) {
    statusLine.textContent =
      'Syncing…';
  }

  const liveDot =
    $('#liveDot');

  if (liveDot) {
    liveDot.className = 'sync';
  }

  try {
    const r =
      await fetch(
        `/api/faction?faction_id=${CONFIG.factionId}`,
        {
          cache: 'no-store'
        }
      );

    let j;

    try {
      j = await r.json();
    } catch {
      throw new Error(
        `Server returned HTTP ${r.status}`
      );
    }

    if (!r.ok) {
      throw new Error(
        j.error ||
        `HTTP ${r.status}`
      );
    }

    render(j);

    if (statusLine) {
      statusLine.textContent =
        j._meta?.cached
          ? 'Live • database'
          : 'Live • synchronized';
    }

    if (liveDot) {
      liveDot.className = '';
    }

    if (
      j._meta?.partial_failures?.length &&
      e
    ) {
      e.textContent =
        `Some Torn feeds were unavailable: ${
          j._meta.partial_failures.join(' • ')
        }`;

      e.classList.remove('hidden');
    }

  } catch (x) {
    if (e) {
      e.textContent =
        `Could not load Torn data: ${x.message}`;

      e.classList.remove('hidden');
    }

    if (statusLine) {
      statusLine.textContent =
        'API unavailable';
    }

    if (liveDot) {
      liveDot.className = 'bad';
    }

    console.error(
      'Faction data load failed:',
      x
    );
  }
}

async function loadLiveChain() {
  try {
    const r =
      await fetch(
        `/api/chain?faction_id=${CONFIG.factionId}`,
        {
          cache: 'no-store'
        }
      );

    let j;

    try {
      j = await r.json();
    } catch {
      return;
    }

    if (!r.ok) {
      console.debug(
        'Live chain request failed:',
        j
      );
      return;
    }

    if (
      !j ||
      j.chain == null
    ) {
      return;
    }

    DATA.chain =
      j.chain;

    renderChain(
      j.chain
    );

  } catch (x) {
    console.debug(
      'Live chain update failed:',
      x
    );
  }
}

setLinks();

document
  .querySelectorAll('.nav')
  .forEach(b => {
    b.addEventListener(
      'click',
      () => {
        document
          .querySelectorAll(
            '.nav,.tab-panel'
          )
          .forEach(x =>
            x.classList.remove(
              'active'
            )
          );

        b.classList.add(
          'active'
        );

        const panel =
          document.getElementById(
            b.dataset.tab
          );

        if (panel) {
          panel.classList.add(
            'active'
          );
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
loadLiveChain();

setInterval(
  load,
  CONFIG.refreshMs
);

setInterval(
  loadLiveChain,
  CONFIG.chainRefreshMs
);

setInterval(
  () => {
    if (DATA.chain) {
      renderChain(
        DATA.chain
      );
    }
  },
  1000
);
