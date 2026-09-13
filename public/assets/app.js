const CONFIG = {
  factionId: 53295,
  discordInvite: 'https://discord.gg/duHJkWRRT',
  tornStats: 'https://www.tornstats.com/factions/53295',
  refreshMs: 300000,
  chainRefreshMs: 5000
};

const $ = s => document.querySelector(s);

const fmt = n =>
  n == null ||
  n === '' ||
  Number.isNaN(Number(n))
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
let LIVE_CHAIN = null;

const tornUrl =
  `https://www.torn.com/factions.php?step=profile&ID=${CONFIG.factionId}`;

const pdaUrl =
  `tornpda://factions.php?step=profile&ID=${CONFIG.factionId}`;

function setLinks() {
  ['tornBtn', 'heroTorn']
    .forEach(id => {
      const el = $('#' + id);
      if (el) el.href = tornUrl;
    });

  ['pdaBtn', 'heroPda']
    .forEach(id => {
      const el = $('#' + id);
      if (el) el.href = pdaUrl;
    });

  const links = {
    discordBtn: CONFIG.discordInvite,
    heroDiscord: CONFIG.discordInvite,
    statsBtn: CONFIG.tornStats
  };

  Object.entries(links)
    .forEach(([id, url]) => {
      const el = $('#' + id);
      if (el) el.href = url;
    });
}

function get(o, ...paths) {
  for (const p of paths) {
    const v =
      p.split('.').reduce(
        (a, k) => a?.[k],
        o
      );

    if (
      v !== undefined &&
      v !== null
    ) {
      return v;
    }
  }

  return undefined;
}

function arr(v) {
  if (Array.isArray(v)) {
    return v;
  }

  if (
    v &&
    typeof v === 'object'
  ) {
    return Object.values(v);
  }

  return [];
}

function fmtTime(v) {
  if (v == null || v === '') {
    return '—';
  }

  if (
    typeof v === 'number' &&
    Number.isFinite(v)
  ) {
    try {
      return new Date(
        v * 1000
      ).toLocaleString();
    } catch {}
  }

  return String(v);
}

function stateCount(ms) {
  return ms.filter(m => {
    const s =
      String(
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

/* =========================================================
   FACTION LEADER
   ========================================================= */

function leaderName(basic, members) {
  const leader =
    get(
      basic,
      'leader',
      'leader_id',
      'leaderId'
    );

  if (
    leader &&
    typeof leader === 'object'
  ) {
    const direct =
      leader.name ||
      leader.username ||
      leader.display_name;

    if (direct) {
      return direct;
    }

    const id =
      leader.id ||
      leader.user_id ||
      leader.player_id;

    if (id) {
      const found =
        members.find(
          m =>
            String(
              m.id ??
              m.user_id ??
              m.player_id
            ) ===
            String(id)
        );

      if (found) {
        return (
          found.name ||
          found.username ||
          String(id)
        );
      }

      return String(id);
    }
  }

  if (
    typeof leader === 'string' &&
    !/^\d+$/.test(leader)
  ) {
    return leader;
  }

  if (
    typeof leader === 'number' ||
    (
      typeof leader === 'string' &&
      /^\d+$/.test(leader)
    )
  ) {
    const found =
      members.find(
        m =>
          String(
            m.id ??
            m.user_id ??
            m.player_id
          ) ===
          String(leader)
      );

    return (
      found?.name ||
      found?.username ||
      String(leader)
    );
  }

  return '—';
}

/* =========================================================
   RANK
   ========================================================= */

function factionRank(basic) {
  const raw =
    get(
      basic,
      'rank',
      'faction_rank',
      'rankedwar.rank'
    );

  if (
    raw &&
    typeof raw === 'object'
  ) {
    const name =
      raw.name ||
      raw.rank ||
      raw.title ||
      raw.value;

    const level =
      raw.level ??
      raw.rank_level ??
      raw.tier ??
      raw.number;

    if (
      name != null &&
      level != null &&
      String(level) !== ''
    ) {
      return `${name} ${level}`;
    }

    if (name != null) {
      return String(name);
    }

    if (level != null) {
      return String(level);
    }
  }

  const rankName =
    get(
      basic,
      'rank.name',
      'rank.rank',
      'rank.title'
    );

  const rankLevel =
    get(
      basic,
      'rank.level',
      'rank.rank_level',
      'rank.tier',
      'rank.number'
    );

  if (
    rankName != null &&
    rankLevel != null
  ) {
    return `${rankName} ${rankLevel}`;
  }

  if (rankName != null) {
    return String(rankName);
  }

  if (raw != null) {
    return String(raw);
  }

  return '—';
}

/* =========================================================
   CHAIN
   ========================================================= */

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
    Math.floor(
      Date.now() / 1000
    );

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

function formatDuration(seconds) {
  let n =
    Math.max(
      0,
      Math.floor(
        Number(seconds) || 0
      )
    );

  const d =
    Math.floor(n / 86400);

  n %= 86400;

  const h =
    Math.floor(n / 3600);

  n %= 3600;

  const m =
    Math.floor(n / 60);

  const s =
    n % 60;

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

  return milestones.find(
    n => n > current
  ) || null;
}

function ensureChainHistoryUI() {
  const chainDetails =
    $('#chainDetails');

  if (!chainDetails) {
    return null;
  }

  let history =
    $('#chainHistory');

  if (history) {
    return history;
  }

  history =
    document.createElement('div');

  history.id =
    'chainHistory';

  history.style.marginTop =
    '18px';

  history.innerHTML = `
    <div style="
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:10px;
      margin-bottom:10px;
    ">
      <div>
        <div style="
          font-size:10px;
          letter-spacing:.14em;
          color:#727985;
          text-transform:uppercase;
        ">
          PREVIOUS CHAINS
        </div>

        <div style="
          font-size:12px;
          color:#8d96a3;
          margin-top:3px;
        ">
          Completed chains recorded by Command
        </div>
      </div>

      <span
        id="chainHistoryCount"
        style="
          font-size:11px;
          color:#8d96a3;
        "
      >
        0
      </span>
    </div>

    <div
      id="chainHistoryRows"
      style="
        display:flex;
        flex-direction:column;
        gap:7px;
      "
    >
      <div style="
        padding:12px;
        border:1px solid #252a33;
        border-radius:8px;
        color:#727985;
        font-size:12px;
      ">
        No completed chains recorded yet.
      </div>
    </div>
  `;

  chainDetails.parentElement.appendChild(
    history
  );

  return history;
}

function renderChainHistory(history) {
  ensureChainHistoryUI();

  const rows =
    $('#chainHistoryRows');

  const count =
    $('#chainHistoryCount');

  if (!rows) {
    return;
  }

  const list =
    Array.isArray(history)
      ? history
      : [];

  if (count) {
    count.textContent =
      `${list.length} recorded`;
  }

  if (!list.length) {
    rows.innerHTML = `
      <div style="
        padding:12px;
        border:1px solid #252a33;
        border-radius:8px;
        color:#727985;
        font-size:12px;
      ">
        No completed chains recorded yet.
      </div>
    `;

    return;
  }

  rows.innerHTML =
    list.slice(0, 50)
      .map((item, index) => {
        const chain =
          Number(
            item.chain_count ??
            item.current ??
            0
          ) || 0;

        const peak =
          Number(
            item.peak_chain ??
            chain
          ) || chain;

        const ended =
          item.ended_at
            ? new Date(
                item.ended_at
              ).toLocaleString()
            : '—';

        const started =
          item.started_at
            ? new Date(
                item.started_at
              ).toLocaleString()
            : '—';

        const duration =
          Number(
            item.duration_seconds
          ) || 0;

        return `
          <div style="
            display:grid;
            grid-template-columns:
              34px
              minmax(90px,1fr)
              minmax(90px,1fr)
              minmax(130px,1.5fr);
            gap:10px;
            align-items:center;
            padding:10px 11px;
            border:1px solid #252a33;
            border-radius:8px;
            background:rgba(255,255,255,.015);
          ">
            <div style="
              color:#555e6b;
              font-size:11px;
              text-align:center;
            ">
              #${esc(index + 1)}
            </div>

            <div>
              <div style="
                font-size:15px;
                font-weight:700;
              ">
                ${esc(fmt(chain))}
              </div>

              <div style="
                font-size:10px;
                color:#727985;
                margin-top:2px;
              ">
                CHAIN
              </div>
            </div>

            <div>
              <div style="
                font-size:13px;
                font-weight:600;
              ">
                ${esc(fmt(peak))}
              </div>

              <div style="
                font-size:10px;
                color:#727985;
                margin-top:2px;
              ">
                PEAK
              </div>
            </div>

            <div>
              <div style="
                font-size:11px;
                color:#a1a8b3;
              ">
                ${esc(ended)}
              </div>

              <div style="
                font-size:10px;
                color:#727985;
                margin-top:3px;
              ">
                ${duration
                  ? esc(
                      formatDuration(
                        duration
                      )
                    )
                  : 'Duration unavailable'}
              </div>
            </div>
          </div>
        `;
      })
      .join('');
}

function renderChain(ch) {
  const state =
    chainState(ch);

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

  const phaseEl =
    $('#chainPhase');

  if (phaseEl) {
    phaseEl.textContent =
      phase;

    phaseEl.className =
      `chain-phase ${phase.toLowerCase()}`;
  }

  if ($('#chainBig')) {
    $('#chainBig').textContent =
      fmt(state.current);
  }

  if ($('#chainBar')) {
    $('#chainBar').style.width =
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

  if ($('#chainTimeout')) {
    $('#chainTimeout').textContent =
      live
        ? `Next hit ${formatDuration(state.timeout)}`
        : 'Next hit —';
  }

  if ($('#chainCooldown')) {
    $('#chainCooldown').textContent =
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

  if ($('#chainDetails')) {
    $('#chainDetails').innerHTML =
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

  renderChainHistory(
    LIVE_CHAIN?.history || []
  );
}

/* =========================================================
   MAIN RENDER
   ========================================================= */

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

  const currentChain =
    get(
      ch,
      'current',
      'current_chain',
      'chain'
    );

  if ($('#chain')) {
    $('#chain').textContent =
      fmt(currentChain);
  }

  if ($('#chainBig')) {
    $('#chainBig').textContent =
      fmt(currentChain);
  }

  if ($('#ocCount')) {
    $('#ocCount').textContent =
      fmt(cs.length);
  }

  if ($('#onlineCount')) {
    $('#onlineCount').textContent =
      fmt(
        stateCount(ms)
      );
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

  const leader =
    leaderName(
      b,
      ms
    );

  const info = [
    [
      'Faction ID',
      CONFIG.factionId
    ],
    [
      'Leader',
      leader
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
      fmtTime(
        get(
          b,
          'age',
          'created'
        )
      )
    ],
    [
      'Members',
      `${ms.length}${
        cap
          ? ` / ${cap}`
          : ''
      }`
    ]
  ];

  if ($('#factionInfo')) {
    $('#factionInfo').innerHTML =
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

  const readiness =
    Math.min(
      100,
      Math.round(
        (
          (
            ms.length
              ? Math.min(
                  1,
                  stateCount(ms) /
                    Math.max(
                      1,
                      ms.length
                    )
                ) * .4
              : .2
          ) * 100
        ) +
        (
          Number(
            currentChain
          )
            ? Math.min(
                1,
                Number(
                  currentChain
                ) / 100
              ) * 40
            : 0
        ) +
        (
          d.rankedwar
            ? 20
            : 0
        )
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

  if ($('#liveInfo')) {
    $('#liveInfo').innerHTML =
      [
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

  if ($('#coverage')) {
    $('#coverage').textContent =
      `${keys.filter(
        k => d[k]
      ).length}/${keys.length}`;
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

/* =========================================================
   TABLES
   ========================================================= */

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

  if (
    cur == null &&
    max == null
  ) {
    return '—';
  }

  if (
    cur != null &&
    max != null
  ) {
    return `${fmt(cur)} / ${fmt(max)}`;
  }

  return fmt(
    cur ?? max
  );
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
    (
      $('#memberSearch')?.value ||
      ''
    ).toLowerCase();

  const rows =
    ms.filter(m =>
      JSON.stringify(m)
        .toLowerCase()
        .includes(q)
    );

  if (!$('#membersTable')) {
    return;
  }

  $('#membersTable').innerHTML =
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

        const id =
          m.id ??
          m.user_id ??
          m.player_id;

        return `
          <tr>
            <td>
              <a
                href="https://www.torn.com/profiles.php?XID=${encodeURIComponent(id)}"
                target="_blank"
                rel="noopener"
              >
                ${esc(
                  m.name ||
                  m.username ||
                  id
                )}
              </a>
            </td>

            <td>
              ${esc(
                m.level ?? '—'
              )}
            </td>

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

            <td>
              ${esc(
                memberLife(m)
              )}
            </td>

            <td>
              ${esc(last)}
            </td>

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
  if ($('#ocNote')) {
    $('#ocNote').textContent =
      `${cs.length} records`;
  }

  if (!$('#crimesTable')) {
    return;
  }

  $('#crimesTable').innerHTML =
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
          </tr>`
      )
      .join('') ||
    '<tr><td colspan="5">No OC data returned.</td></tr>';
}

function renderArmory(items) {
  const q =
    (
      $('#armorySearch')?.value ||
      ''
    ).toLowerCase();

  if (!$('#armoryTable')) {
    return;
  }

  $('#armoryTable').innerHTML =
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

  if ($('#warBadge')) {
    $('#warBadge').textContent =
      r &&
      Object.keys(r).length
        ? 'DATA'
        : 'NO ACTIVE DATA';
  }

  if ($('#warInfo')) {
    $('#warInfo').innerHTML =
      entries
        .map(
          ([k, v]) =>
            `<div class="list-row">
              <span>${esc(
                k.replaceAll(
                  '_',
                  ' '
                )
              )}</span>
              <b>${esc(v)}</b>
            </div>`
        )
        .join('') ||
      '<div class="empty">No ranked-war data returned.</div>';
  }
}

function renderTerritory(t) {
  const entries =
    Object.entries(t || {})
      .filter(
        ([, v]) =>
          typeof v !== 'object'
      )
      .slice(0, 24);

  if ($('#territoryInfo')) {
    $('#territoryInfo').innerHTML =
      entries
        .map(
          ([k, v]) =>
            `<div class="list-row">
              <span>${esc(
                k.replaceAll(
                  '_',
                  ' '
                )
              )}</span>
              <b>${esc(v)}</b>
            </div>`
        )
        .join('') ||
      '<div class="empty">No territory data returned.</div>';
  }
}

function renderUpgrades(us) {
  if (!$('#upgradesInfo')) {
    return;
  }

  $('#upgradesInfo').innerHTML =
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
  const el =
    $('#' + id);

  if (!el) {
    return;
  }

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
        k => k !== 'id'
      )
      .slice(0, 4);

  el.innerHTML =
    `<table>
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
                  .map(
                    c =>
                      `<td>${esc(
                        typeof o === 'object'
                          ? typeof o[c] === 'object'
                            ? JSON.stringify(o[c])
                            : o[c]
                          : o
                      )}</td>`
                  )
                  .join('')}
              </tr>`
          )
          .join('')}
      </tbody>
    </table>`;
}

/* =========================================================
   LIVE CHAIN POLLING
   ========================================================= */

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

    LIVE_CHAIN =
      data;

    if (data.chain) {
      DATA.chain =
        data.chain;

      renderChain(
        data.chain
      );

      if ($('#chain')) {
        $('#chain').textContent =
          fmt(
            get(
              data.chain,
              'current',
              'current_chain',
              'chain'
            )
          );
      }
    }

    renderChainHistory(
      data.history || []
    );

  } catch {
    // Keep the last successful live state.
  }
}

/* =========================================================
   MAIN DATA LOAD
   ========================================================= */

async function load() {
  const e =
    $('#error');

  if (e) {
    e.classList.add(
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
    const r =
      await fetch(
        `/api/faction?faction_id=${CONFIG.factionId}`,
        {
          cache: 'no-store'
        }
      );

    const j =
      await r.json();

    if (!r.ok) {
      throw new Error(
        j.error ||
        `HTTP ${r.status}`
      );
    }

    render(j);

    if ($('#statusLine')) {
      $('#statusLine').textContent =
        j._meta?.cached
          ? 'Live • database'
          : 'Live • synchronized';
    }

    if ($('#liveDot')) {
      $('#liveDot').className =
        '';
    }

    if (
      j._meta?.partial_failures?.length &&
      e
    ) {
      e.textContent =
        `Some Torn feeds were unavailable: ${
          j._meta.partial_failures.join(
            ' • '
          )
        }`;

      e.classList.remove(
        'hidden'
      );
    }

  } catch (x) {
    if (e) {
      e.textContent =
        `Could not load Torn data: ${x.message}`;

      e.classList.remove(
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

/* =========================================================
   START
   ========================================================= */

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
          .forEach(
            x =>
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

if ($('#refreshBtn')) {
  $('#refreshBtn').onclick =
    load;
}

if ($('#memberSearch')) {
  $('#memberSearch')
    .addEventListener(
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

if ($('#armorySearch')) {
  $('#armorySearch')
    .addEventListener(
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
