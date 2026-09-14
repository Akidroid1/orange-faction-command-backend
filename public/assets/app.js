const CONFIG = {
  factionId: 53295,
  discordInvite: 'https://discord.gg/duHJkWRRT',
  tornStats: 'https://www.tornstats.com/factions/53295',
  refreshMs: 300000,
  chainRefreshMs: 5000,
  activityClockMs: 60000
};

const $ = s => document.querySelector(s);

const fmt = n =>
  n == null || n === '' || Number.isNaN(Number(n))
    ? '—'
    : Number(n).toLocaleString();

const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[c])
  );

let DATA = {};
let chainTimer = null;
let activityTimer = null;

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
    const v = p
      .split('.')
      .reduce((a, k) => a?.[k], o);

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
  if (v == null || v === '') {
    return '—';
  }

  if (typeof v === 'number') {
    try {
      return new Date(v * 1000).toLocaleString();
    } catch {}
  }

  return String(v);
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

function formatActivity(timestamp, relative) {
  if (timestamp != null && timestamp !== '') {
    const ts = Number(timestamp);

    if (Number.isFinite(ts) && ts > 0) {
      const diff =
        Math.max(
          0,
          Math.floor(Date.now() / 1000) - ts
        );

      if (diff < 60) {
        return 'Active now';
      }

      if (diff < 3600) {
        return `${Math.floor(diff / 60)}m ago`;
      }

      if (diff < 86400) {
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);

        return m
          ? `${h}h ${m}m ago`
          : `${h}h ago`;
      }

      const d = Math.floor(diff / 86400);

      if (d < 30) {
        return `${d}d ago`;
      }

      return new Date(ts * 1000).toLocaleDateString();
    }
  }

  if (relative != null && relative !== '') {
    return String(relative);
  }

  return '—';
}

function getMemberStatus(m) {
  const state = String(
    get(
      m,
      'status.state',
      'status.status',
      'status.description',
      'state',
      'status'
    ) || ''
  ).trim();

  const lower = state.toLowerCase();

  if (lower.includes('hospital')) {
    return 'Hospital';
  }

  if (lower.includes('jail')) {
    return 'Jail';
  }

  if (
    lower.includes('abroad') ||
    lower.includes('travel') ||
    lower.includes('travelling') ||
    lower.includes('traveling')
  ) {
    return 'Abroad';
  }

  if (
    lower === 'online' ||
    lower === 'active'
  ) {
    return 'Online';
  }

  if (
    lower === 'okay' ||
    lower === 'ok'
  ) {
    return 'OK';
  }

  if (lower) {
    return state;
  }

  return 'Offline';
}

function getMemberActivity(m) {
  const timestamp = get(
    m,
    'last_action.timestamp',
    'last_action.time',
    'last_action.unix'
  );

  const relative = get(
    m,
    'last_action.relative',
    'last_action.description',
    'last_action'
  );

  return {
    timestamp,
    relative
  };
}

function memberActivityText(m) {
  const activity = getMemberActivity(m);

  return formatActivity(
    activity.timestamp,
    activity.relative
  );
}

function stateCount(ms) {
  return ms.filter(m => {
    const status =
      getMemberStatus(m).toLowerCase();

    return [
      'online',
      'ok',
      'active'
    ].includes(status);
  }).length;
}

function countStatus(ms, wanted) {
  return ms.filter(m =>
    getMemberStatus(m)
      .toLowerCase() === wanted
  ).length;
}

function leaderName(b) {
  const leader = get(
    b,
    'leader.name',
    'leader.username',
    'leader',
    'leader_name'
  );

  if (
    leader &&
    typeof leader === 'object'
  ) {
    return (
      leader.name ||
      leader.username ||
      leader.id ||
      '—'
    );
  }

  return leader || '—';
}

function factionAge(b) {
  const days = get(
    b,
    'days_old',
    'age.days',
    'age'
  );

  if (days != null) {
    const n = Number(days);

    if (Number.isFinite(n)) {
      return `${fmt(n)} days`;
    }
  }

  const created = get(
    b,
    'created',
    'created_at'
  );

  return fmtTime(created);
}

function factionRank(b) {
  const rank = get(
    b,
    'rank',
    'rankedwar.rank'
  );

  if (!rank) {
    return '—';
  }

  if (typeof rank === 'string') {
    return rank;
  }

  if (typeof rank === 'object') {
    const name =
      rank.name ||
      rank.rank ||
      '';

    const division =
      rank.division ??
      rank.position ??
      '';

    if (name && division !== '') {
      return `${name} ${division}`;
    }

    return name || '—';
  }

  return String(rank);
}

function chainState(ch) {
  const current =
    Number(
      get(
        ch,
        'current',
        'current_chain',
        'chain'
      )
    ) || 0;

  const max =
    Number(
      get(
        ch,
        'max',
        'max_chain'
      )
    ) || 0;

  const timeout =
    Number(
      get(
        ch,
        'timeout',
        'chain.timeout'
      )
    ) || 0;

  const cooldownRaw =
    get(
      ch,
      'cooldown',
      'chain.cooldown'
    );

  const cooldown =
    Number(cooldownRaw) || 0;

  const now =
    Math.floor(Date.now() / 1000);

  const cooldownRemaining =
    cooldown > now
      ? cooldown - now
      : 0;

  return {
    current,
    max,
    timeout,
    cooldown,
    cooldownRemaining
  };
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

  return milestones.find(
    n => n > current
  ) || null;
}

function renderChain(ch) {
  const state = chainState(ch);

  const next =
    nextChainMilestone(
      state.current
    );

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

  if (phaseEl) {
    phaseEl.textContent = phase;
    phaseEl.className =
      `chain-phase ${phase.toLowerCase()}`;
  }

  const big = $('#chainBig');

  if (big) {
    big.textContent =
      fmt(state.current);
  }

  const bar = $('#chainBar');

  if (bar) {
    bar.style.width =
      (
        state.max
          ? Math.min(
              100,
              state.current /
                state.max *
                100
            )
          : 0
      ) + '%';
  }

  const timeout = $('#chainTimeout');

  if (timeout) {
    timeout.textContent =
      live
        ? `Next hit ${formatDuration(state.timeout)}`
        : 'Next hit —';
  }

  const cooldownEl =
    $('#chainCooldown');

  if (cooldownEl) {
    cooldownEl.textContent =
      cooldown
        ? `Cooldown ${formatDuration(state.cooldownRemaining)}`
        : 'Cooldown —';
  }

  const rows = [
    [
      'Current chain',
      fmt(state.current)
    ],
    [
      'Chain target',
      state.max
        ? fmt(state.max)
        : '—'
    ],
    [
      'Next bonus hit',
      next
        ? fmt(next)
        : 'Maximum reached'
    ],
    [
      'Progress',
      state.max
        ? `${Math.min(
            100,
            state.current /
              state.max *
              100
          ).toFixed(1)}%`
        : '—'
    ],
    [
      'Timeout',
      live
        ? formatDuration(
            state.timeout
          )
        : '—'
    ],
    [
      'Cooldown',
      cooldown
        ? formatDuration(
            state.cooldownRemaining
          )
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

  const details =
    $('#chainDetails');

  if (details) {
    details.innerHTML =
      rows
        .map(
          x =>
            `<div class="list-row">
              <span>${esc(x[0])}</span>
              <b>${esc(x[1])}</b>
            </div>`
        )
        .join('');
  }
}

function updateMemberActivityClock() {
  if (!DATA) return;

  const ms =
    arr(
      DATA.members?.members ||
      DATA.members
    );

  if (!ms.length) return;

  renderMembers(ms);
}

function updateChainClock() {
  if (DATA?.chain) {
    renderChain(DATA.chain);
  }
}

function renderMembers(ms) {
  const search =
    ($('#memberSearch')?.value || '')
      .toLowerCase();

  const rows =
    ms.filter(m =>
      JSON.stringify(m)
        .toLowerCase()
        .includes(search)
    );

  const table =
    $('#membersTable');

  if (!table) return;

  /*
   * The original HTML has a Life column.
   * We do not use it anymore because the
   * member dashboard was changed to show
   * activity/status instead.
   */
  const header =
    document.querySelector(
      '#members thead tr'
    );

  if (header) {
    const headers =
      header.querySelectorAll('th');

    if (headers[3]) {
      headers[3].textContent =
        'Status';
    }

    if (headers[4]) {
      headers[4].textContent =
        'Activity';
    }

    if (headers[5]) {
      headers[5].textContent =
        'State';
    }
  }

  table.innerHTML =
    rows
      .map(m => {
        const status =
          getMemberStatus(m);

        const activity =
          memberActivityText(m);

        const cls =
          status
            .toLowerCase()
            .replace(
              /[^a-z0-9]+/g,
              '-'
            );

        const id =
          m.id ??
          m.user_id ??
          '';

        const name =
          m.name ||
          m.username ||
          id ||
          'Unknown';

        const position =
          get(
            m,
            'position.name',
            'position',
            'role'
          ) || '—';

        return `
          <tr>
            <td>
              <a
                href="https://www.torn.com/profiles.php?XID=${encodeURIComponent(id)}"
                target="_blank"
                rel="noopener"
              >${esc(name)}</a>
            </td>

            <td>${esc(m.level ?? '—')}</td>

            <td>${esc(position)}</td>

            <td>
              <span class="pill status-${esc(cls)}">
                ${esc(status)}
              </span>
            </td>

            <td>${esc(activity)}</td>

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
  const note =
    $('#ocNote');

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
      .map(c => `
        <tr>
          <td>
            ${esc(
              c.name ||
              c.crime_name ||
              c.id ||
              'OC'
            )}
          </td>

          <td>
            <span class="pill">
              ${esc(
                c.status ||
                c.state ||
                '—'
              )}
            </span>
          </td>

          <td>
            ${esc(
              fmtTime(
                c.created_at ||
                c.created
              )
            )}
          </td>

          <td>
            ${fmt(
              arr(
                c.participants ||
                c.slots
              ).length
            )}
          </td>

          <td>
            ${esc(
              c.difficulty ||
              c.success ||
              '—'
            )}
          </td>
        </tr>
      `)
      .join('') ||
    '<tr><td colspan="5">No OC data returned. The API key may not have the required faction selection.</td></tr>';
}

function renderArmory(items) {
  const search =
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
          .includes(search)
      )
      .slice(0, 300)
      .map(i => `
        <tr>
          <td>
            ${esc(
              i.name ||
              i.item_name ||
              i.id ||
              'Item'
            )}
          </td>

          <td>
            ${esc(
              i.type ||
              i.category ||
              '—'
            )}
          </td>

          <td>
            ${fmt(
              i.quantity ??
              i.qty ??
              i.amount
            )}
          </td>

          <td>
            ${esc(i.id ?? '—')}
          </td>
        </tr>
      `)
      .join('') ||
    '<tr><td colspan="4">Armory inventory is unavailable from this API selection.</td></tr>';
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

  const rows =
    arr(data);

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
        sample.flatMap(
          o =>
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
          ${cols
            .map(
              c =>
                `<th>${esc(
                  c.replaceAll(
                    '_',
                    ' '
                  )
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
                    let value =
                      typeof o ===
                      'object'
                        ? o[c]
                        : o;

                    if (
                      typeof value ===
                      'object'
                    ) {
                      try {
                        value =
                          JSON.stringify(
                            value
                          );
                      } catch {
                        value =
                          String(value);
                      }
                    }

                    return `<td>${esc(
                      value
                    )}</td>`;
                  })
                  .join('')}
              </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function render(d) {
  DATA = d;

  const b =
    d.basic || {};

  const ms =
    arr(
      d.members?.members ||
      d.members
    );

  const cs =
    arr(
      d.crimes?.crimes ||
      d.crimes
    );

  const ar =
    arr(
      d.armory?.items ||
      d.armory
    );

  const ch =
    d.chain || {};

  const name =
    b.name || 'ORANGE';

  if ($('#factionName')) {
    $('#factionName').textContent =
      name;
  }

  if ($('#heroTitle')) {
    $('#heroTitle').textContent =
      name;
  }

  if ($('#heroSub')) {
    $('#heroSub').textContent =
      `Faction #${CONFIG.factionId} • Command intelligence synchronized from Torn`;
  }

  const respect =
    get(
      b,
      'respect',
      'respect_value'
    );

  if ($('#respect')) {
    $('#respect').textContent =
      fmt(respect);
  }

  if ($('#membersCount')) {
    $('#membersCount').textContent =
      fmt(
        get(
          b,
          'members.member_count',
          'member_count'
        ) ?? ms.length
      );
  }

  const cap =
    get(
      b,
      'capacity',
      'member_capacity',
      'members.member_capacity'
    );

  if ($('#capacitySmall')) {
    $('#capacitySmall').textContent =
      `Capacity ${fmt(cap)}`;
  }

  const rank =
    factionRank(b);

  if ($('#rank')) {
    $('#rank').textContent =
      rank;
  }

  const chainNow =
    Number(
      get(
        ch,
        'current',
        'current_chain',
        'chain'
      )
    ) || 0;

  if ($('#chain')) {
    $('#chain').textContent =
      fmt(chainNow);
  }

  if ($('#chainBig')) {
    $('#chainBig').textContent =
      fmt(chainNow);
  }

  if ($('#ocCount')) {
    $('#ocCount').textContent =
      fmt(cs.length);
  }

  if ($('#onlineCount')) {
    $('#onlineCount').textContent =
      fmt(stateCount(ms));
  }

  const now =
    new Date();

  if ($('#updated')) {
    $('#updated').textContent =
      now.toLocaleTimeString();
  }

  if ($('#footerUpdated')) {
    $('#footerUpdated').textContent =
      now.toLocaleTimeString();
  }

  if ($('#feedTime')) {
    $('#feedTime').textContent =
      now.toLocaleTimeString();
  }

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
      rank
    ],
    [
      'Age',
      factionAge(b)
    ],
    [
      'Members',
      `${ms.length}${cap ? ` / ${cap}` : ''}`
    ]
  ];

  const factionInfo =
    $('#factionInfo');

  if (factionInfo) {
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

  /*
   * Readiness calculation.
   * Uses the current chain value directly.
   * This fixes the old undefined "chainNow" error.
   */
  const memberReadiness =
    ms.length
      ? Math.min(
          1,
          stateCount(ms) /
            Math.max(1, ms.length)
        ) * 40
      : 8;

  const chainReadiness =
    Math.min(
      1,
      chainNow / 100
    ) * 40;

  const warReadiness =
    d.rankedwar ? 20 : 0;

  const readiness =
    Math.min(
      100,
      Math.round(
        memberReadiness +
        chainReadiness +
        warReadiness
      )
    );

  if ($('#readiness')) {
    $('#readiness').textContent =
      readiness + '%';
  }

  if ($('#readinessTitle')) {
    $('#readinessTitle').textContent =
      readiness >= 75
        ? 'Combat ready'
        : readiness >= 45
          ? 'Operational'
          : 'Standby';
  }

  if ($('#readinessText')) {
    $('#readinessText').textContent =
      `${ms.length} members tracked • ${cs.length} OC records • ${
        d.rankedwar
          ? 'war data available'
          : 'no active war data returned'
      }`;
  }

  const liveInfo =
    $('#liveInfo');

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
        d._meta
          ?.partial_failures
          ?.length || 0
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

  if ($('#coverage')) {
    $('#coverage').textContent =
      `${keys.filter(k => d[k]).length}/${keys.length}`;
  }

  if ($('#coverageInfo')) {
    $('#coverageInfo').innerHTML =
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

  /*
   * Keep every existing renderer.
   * Nothing from these sections is removed.
   */
  renderMembers(ms);
  renderCrimes(cs);
  renderArmory(ar);
  renderWar(d.rankedwar || {});
  renderTerritory(
    d.territory || {}
  );
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

async function load() {
  const error =
    $('#error');

  if (error) {
    error.classList.add(
      'hidden'
    );
  }

  if ($('#statusLine')) {
    $('#statusLine').textContent =
      'Syncing…';
  }

  if ($('#liveDot')) {
    $('#liveDot').className =
      'sync';
  }

  try {
    const response =
      await fetch(
        `/api/faction?faction_id=${CONFIG.factionId}`,
        {
          cache: 'no-store'
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        `HTTP ${response.status}`
      );
    }

    render(data);

    if ($('#statusLine')) {
      $('#statusLine').textContent =
        data._meta?.cached
          ? 'Live • database'
          : 'Live • synchronized';
    }

    if ($('#liveDot')) {
      $('#liveDot').className =
        '';
    }

    if (
      data._meta
        ?.partial_failures
        ?.length
    ) {
      if (error) {
        error.textContent =
          `Some Torn feeds were unavailable: ${
            data._meta.partial_failures.join(
              ' • '
            )
          }`;

        error.classList.remove(
          'hidden'
        );
      }
    }
  } catch (x) {
    if (error) {
      error.textContent =
        `Could not load Torn data: ${x.message}`;

      error.classList.remove(
        'hidden'
      );
    }

    if ($('#statusLine')) {
      $('#statusLine').textContent =
        'API unavailable';
    }

    if ($('#liveDot')) {
      $('#liveDot').className =
        'bad';
    }
  }
}

async function loadLiveChain() {
  try {
    const response =
      await fetch(
        `/api/chain?faction_id=${CONFIG.factionId}`,
        {
          cache: 'no-store'
        }
      );

    if (!response.ok) {
      return;
    }

    const data =
      await response.json();

    if (
      !data ||
      !data.chain
    ) {
      return;
    }

    DATA.chain =
      data.chain;

    renderChain(
      DATA.chain
    );

    if ($('#chain')) {
      $('#chain').textContent =
        fmt(
          get(
            DATA.chain,
            'current',
            'current_chain',
            'chain'
          )
        );
    }

    if ($('#chainBig')) {
      $('#chainBig').textContent =
        fmt(
          get(
            DATA.chain,
            'current',
            'current_chain',
            'chain'
          )
        );
    }
  } catch {
    /*
     * Normal faction data remains
     * untouched if the live chain
     * endpoint is unavailable.
     */
  }
}

function initNavigation() {
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
              x.classList.remove(
                'active'
              )
            );

          button.classList.add(
            'active'
          );

          const panel =
            $('#' +
              button.dataset.tab);

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
}

function initSearch() {
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
}

function startTimers() {
  clearInterval(
    chainTimer
  );

  clearInterval(
    activityTimer
  );

  chainTimer =
    setInterval(
      loadLiveChain,
      CONFIG.chainRefreshMs
    );

  activityTimer =
    setInterval(
      updateMemberActivityClock,
      CONFIG.activityClockMs
    );
}

setLinks();

initNavigation();

initSearch();

const refreshButton =
  $('#refreshBtn');

if (refreshButton) {
  refreshButton.onclick =
    load;
}

load();

startTimers();

setInterval(
  load,
  CONFIG.refreshMs
);
