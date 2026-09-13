const CONFIG = {
  factionId: 53295,
  discordInvite: 'https://discord.gg/duHJkWRRT',
  tornStats: 'https://www.tornstats.com/factions/53295',
  refreshMs: 300000
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


/* -------------------------------------------------------
   LINKS
------------------------------------------------------- */

function setLinks() {
  ['tornBtn', 'heroTorn'].forEach(id => {
    const el = $('#' + id);
    if (el) el.href = tornUrl;
  });

  ['pdaBtn', 'heroPda'].forEach(id => {
    const el = $('#' + id);
    if (el) el.href = pdaUrl;
  });

  const discord = $('#discordBtn');
  const heroDiscord = $('#heroDiscord');
  const stats = $('#statsBtn');

  if (discord) discord.href = CONFIG.discordInvite;
  if (heroDiscord) heroDiscord.href = CONFIG.discordInvite;
  if (stats) stats.href = CONFIG.tornStats;
}


/* -------------------------------------------------------
   DATA HELPERS
------------------------------------------------------- */

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


/*
 * Safely converts Torn objects into readable text.
 * Prevents [object Object].
 */
function scalar(v, fallback = '—') {

  if (v == null || v === '') {
    return fallback;
  }

  if (typeof v === 'object') {

    for (const key of [
      'name',
      'title',
      'label',
      'value',
      'rank',
      'division'
    ]) {

      if (
        v[key] != null &&
        typeof v[key] !== 'object'
      ) {
        return String(v[key]);
      }

    }

    return fallback;
  }

  return String(v);
}


/* -------------------------------------------------------
   FACTION LEADER
------------------------------------------------------- */

function leaderName(basic) {

  const leader = get(basic, 'leader');

  if (
    leader &&
    typeof leader === 'object'
  ) {

    return scalar(
      leader.name ||
      leader.username ||
      leader.title ||
      leader.id
    );

  }

  return scalar(
    get(
      basic,
      'leader_name',
      'leaderName'
    ),
    '—'
  );
}


/* -------------------------------------------------------
   FACTION RANK
------------------------------------------------------- */

function factionRank(basic) {

  const rank = get(basic, 'rank');

  /*
   * Torn can return rank as an object.
   * Example:
   * { name: "Gold", division: 2 }
   */

  if (
    rank &&
    typeof rank === 'object'
  ) {

    const name = scalar(
      rank.name ||
      rank.rank ||
      rank.title,
      ''
    );

    const division = scalar(
      rank.division,
      ''
    );

    if (name && division) {
      return `${name} ${division}`;
    }

    if (name) {
      return name;
    }

    if (division) {
      return division;
    }
  }

  /*
   * Fallback for ranked-war rank.
   */

  const alternate = get(
    basic,
    'rankedwar.rank',
    'rankedwars.rank'
  );

  if (
    alternate &&
    typeof alternate === 'object'
  ) {

    return scalar(
      alternate.name ||
      alternate.rank ||
      alternate.title,
      '—'
    );
  }

  return scalar(
    alternate || rank,
    '—'
  );
}


/* -------------------------------------------------------
   FACTION AGE
------------------------------------------------------- */

function factionAge(basic) {

  /*
   * If Torn directly supplies the age in days.
   */

  const age = get(
    basic,
    'age',
    'age_days',
    'days_old'
  );

  if (
    typeof age === 'number' &&
    age >= 0 &&
    age < 100000
  ) {

    return `${fmt(age)} days`;
  }

  if (
    typeof age === 'string' &&
    /^\d+(?:\.\d+)?$/.test(age)
  ) {

    return `${fmt(Number(age))} days`;
  }


  /*
   * Otherwise calculate age from creation date.
   */

  const created = get(
    basic,
    'created',
    'created_at',
    'creation_date',
    'created_timestamp'
  );

  if (created != null) {

    const n = Number(created);

    let ms;

    if (
      Number.isFinite(n) &&
      n > 0
    ) {

      /*
       * Supports both Unix seconds
       * and Unix milliseconds.
       */

      ms =
        n > 100000000000
          ? n
          : n * 1000;

    } else {

      ms = Date.parse(String(created));
    }

    if (Number.isFinite(ms)) {

      const days = Math.max(
        0,
        Math.floor(
          (Date.now() - ms) /
          86400000
        )
      );

      const years =
        Math.floor(days / 365);

      const months =
        Math.floor(
          (days % 365) / 30
        );

      const remainingDays =
        days % 30;

      const parts = [];

      if (years) {
        parts.push(`${years}y`);
      }

      if (months || years) {
        parts.push(`${months}m`);
      }

      if (!years && !months) {
        parts.push(`${remainingDays}d`);
      }

      return parts.join(' ');
    }
  }

  return '—';
}


/* -------------------------------------------------------
   TIME
------------------------------------------------------- */

function fmtTime(v) {

  if (v == null || v === '') {
    return '—';
  }

  if (typeof v === 'number') {

    try {

      const ms =
        v > 100000000000
          ? v
          : v * 1000;

      return new Date(ms).toLocaleString();

    } catch {}
  }

  if (/^\d+$/.test(String(v))) {

    const n = Number(v);

    try {

      const ms =
        n > 100000000000
          ? n
          : n * 1000;

      return new Date(ms).toLocaleString();

    } catch {}
  }

  return String(v);
}


/* -------------------------------------------------------
   MEMBER STATUS
------------------------------------------------------- */

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


/* -------------------------------------------------------
   CHAIN
------------------------------------------------------- */

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

  $('#chainPhase').textContent =
    phase;

  $('#chainPhase').className =
    `chain-phase ${phase.toLowerCase()}`;

  $('#chainBig').textContent =
    fmt(state.current);

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

  $('#chainTimeout').textContent =
    live
      ? `Next hit ${formatDuration(state.timeout)}`
      : 'Next hit —';

  $('#chainCooldown').textContent =
    cooldown
      ? `Cooldown ${formatDuration(state.cooldownRemaining)}`
      : 'Cooldown —';

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
            (
              state.current /
              state.max
            ) * 100
          ).toFixed(1)}%`
        : '—'
    ],
    [
      'Timeout',
      live
        ? formatDuration(state.timeout)
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

  $('#chainDetails').innerHTML =
    rows.map(x =>
      `<div class="list-row">
        <span>${esc(x[0])}</span>
        <b>${esc(x[1])}</b>
      </div>`
    ).join('');
}


/* -------------------------------------------------------
   PREVIOUS CHAIN HISTORY
------------------------------------------------------- */

function chainHistoryArray(value) {

  if (Array.isArray(value)) {
    return value;
  }

  if (
    value &&
    typeof value === 'object'
  ) {

    if (Array.isArray(value.chains)) {
      return value.chains;
    }

    if (
      value.data &&
      Array.isArray(value.data)
    ) {
      return value.data;
    }

    return Object.values(value)
      .filter(
        v =>
          v &&
          typeof v === 'object'
      );
  }

  return [];
}


function chainHits(c) {

  return Number(
    get(
      c,
      'chain',
      'current',
      'hits',
      'attacks',
      'chain_length',
      'length',
      'end'
    )
  ) || 0;
}


function chainStart(c) {

  return get(
    c,
    'start',
    'start_time',
    'started_at',
    'created_at',
    'timestamp'
  );
}


function chainEnd(c) {

  return get(
    c,
    'end',
    'end_time',
    'ended_at',
    'completed_at',
    'finished_at'
  );
}


function chainDuration(c) {

  const direct =
    get(
      c,
      'duration',
      'duration_seconds',
      'length_seconds'
    );

  if (
    direct != null &&
    direct !== ''
  ) {

    return formatDuration(
      Number(direct)
    );
  }

  const a =
    Number(chainStart(c));

  const b =
    Number(chainEnd(c));

  if (
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    a > 0 &&
    b > 0 &&
    b >= a
  ) {

    return formatDuration(
      b - a
    );
  }

  return '—';
}


function renderChainHistory(value) {

  const rows =
    chainHistoryArray(value)
      .sort((a, b) => {

        const ta =
          Number(
            chainEnd(a) ||
            chainStart(a) ||
            a.id ||
            0
          );

        const tb =
          Number(
            chainEnd(b) ||
            chainStart(b) ||
            b.id ||
            0
          );

        return tb - ta;

      })
      .slice(0, 100);

  const note =
    $('#chainHistoryNote');

  if (note) {

    note.textContent =
      `${rows.length} completed chain${
        rows.length === 1
          ? ''
          : 's'
      }`;
  }

  const body =
    $('#chainHistoryTable');

  if (!body) return;

  body.innerHTML =
    rows.map(c => {

      const id =
        get(
          c,
          'id',
          'chain_id'
        ) ?? '—';

      const hits =
        chainHits(c);

      const start =
        chainStart(c);

      const end =
        chainEnd(c);

      const bonuses =
        get(
          c,
          'bonus_hits',
          'bonuses',
          'bonus',
          'bonus_count'
        );

      const avg =
        get(
          c,
          'average_respect',
          'avg_respect',
          'averageRespect'
        );

      return `
        <tr>
          <td><b>#${esc(id)}</b></td>
          <td>${fmt(hits)}</td>
          <td>${esc(fmtTime(start))}</td>
          <td>${esc(fmtTime(end))}</td>
          <td>${esc(chainDuration(c))}</td>
          <td>${esc(bonuses ?? '—')}</td>
          <td>${esc(avg ?? '—')}</td>
        </tr>
      `;

    }).join('') ||
    `
      <tr>
        <td colspan="7">
          No completed chain history returned yet.
        </td>
      </tr>
    `;
}


/* -------------------------------------------------------
   MAIN RENDER
------------------------------------------------------- */

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

  $('#factionName').textContent =
    name;

  $('#heroTitle').textContent =
    name;

  $('#heroSub').textContent =
    `Faction #${CONFIG.factionId} • Command intelligence synchronized from Torn`;


  /* -------------------------
     BASIC KPI DATA
  ------------------------- */

  const respect =
    get(
      b,
      'respect',
      'respect_value'
    );

  $('#respect').textContent =
    fmt(respect);

  $('#membersCount').textContent =
    fmt(
      get(
        b,
        'members.member_count',
        'member_count'
      ) ?? ms.length
    );

  const cap =
    get(
      b,
      'capacity',
      'member_capacity',
      'members.member_capacity'
    );

  $('#capacitySmall').textContent =
    `Capacity ${fmt(cap)}`;


  /*
   * FIXED:
   * Command chain now uses commandChain.
   * It no longer conflicts with the Chain tab.
   */

  $('#commandChain').textContent =
    fmt(
      get(
        ch,
        'current',
        'current_chain',
        'chain'
      )
    );


  $('#chainBig').textContent =
    fmt(
      get(
        ch,
        'current',
        'current_chain',
        'chain'
      )
    );


  $('#rank').textContent =
    factionRank(b);

  $('#ocCount').textContent =
    fmt(cs.length);

  $('#onlineCount').textContent =
    fmt(stateCount(ms));


  const now =
    new Date();

  $('#updated').textContent =
    now.toLocaleTimeString();

  $('#footerUpdated').textContent =
    now.toLocaleTimeString();

  $('#feedTime').textContent =
    now.toLocaleTimeString();


  /* -------------------------
     FACTION INTEL
  ------------------------- */

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
      `${ms.length}${
        cap
          ? ` / ${cap}`
          : ''
      }`
    ]

  ];


  $('#factionInfo').innerHTML =
    info.map(x =>
      `<div>
        <span>${esc(x[0])}</span>
        <b>${esc(x[1])}</b>
      </div>`
    ).join('');


  /* -------------------------
     CHAIN
  ------------------------- */

  renderChain(ch);

  renderChainHistory(
    d.chains
  );


  /* -------------------------
     READINESS
  ------------------------- */

  const chainNow =
    Number(
      get(
        ch,
        'current',
        'current_chain',
        'chain'
      )
    ) || 0;

  const readiness =
    Math.min(
      100,
      Math.round(

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

        +

        (
          chainNow
            ? Math.min(
                1,
                chainNow / 100
              ) * 40
            : 0
        )

        +

        (
          d.rankedwar
            ? 20
            : 0
        )

      )
    );


  $('#readiness').textContent =
    readiness + '%';

  $('#readinessTitle').textContent =
    readiness >= 75
      ? 'Combat ready'
      : readiness >= 45
        ? 'Operational'
        : 'Standby';

  $('#readinessText').textContent =
    `${ms.length} members tracked • ` +
    `${cs.length} OC records • ` +
    `${
      d.rankedwar
        ? 'war data available'
        : 'no active war data returned'
    }`;


  /* -------------------------
     OPERATIONS FEED
  ------------------------- */

  $('#liveInfo').innerHTML = [

    [
      'Roster',
      `${ms.length} members / ` +
      `${stateCount(ms)} active`
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


  /* -------------------------
     DATA COVERAGE
  ------------------------- */

  const keys = [
    'basic',
    'members',
    'chain',
    'chains',
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


  $('#coverage').textContent =
    keys.filter(
      k => d[k]
    ).length +
    '/' +
    keys.length;


  $('#coverageInfo').innerHTML =
    keys.map(k =>
      `<div class="coverage-row">
        <span>${esc(k)}</span>
        <i class="${d[k] ? 'ok' : 'no'}">
          ${d[k] ? '●' : '○'}
        </i>
      </div>`
    ).join('');


  /* -------------------------
     OTHER TABS
  ------------------------- */

  renderMembers(ms);

  renderCrimes(cs);

  renderArmory(ar);

  renderWar(
    d.rankedwar || {}
  );

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


/* -------------------------------------------------------
   MEMBERS
------------------------------------------------------- */

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


  $('#membersTable').innerHTML =
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
              ${esc(
                m.name ||
                m.username ||
                m.id
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
            <span
              class="pill status-${esc(cls)}"
            >
              ${esc(status)}
            </span>
          </td>

        </tr>
      `;

    }).join('') ||

    `
      <tr>
        <td colspan="6">
          No member data returned.
        </td>
      </tr>
    `;
}


/* -------------------------------------------------------
   ORGANIZED CRIMES
------------------------------------------------------- */

function renderCrimes(cs) {

  $('#ocNote').textContent =
    `${cs.length} records`;

  $('#crimesTable').innerHTML =
    cs
      .slice(0, 150)
      .map(c =>
        `
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
        `
      )
      .join('') ||

    `
      <tr>
        <td colspan="5">
          No OC data returned.
          The API key may not have
          the required faction selection.
        </td>
      </tr>
    `;
}


/* -------------------------------------------------------
   ARMORY
------------------------------------------------------- */

function renderArmory(items) {

  const q =
    (
      $('#armorySearch')?.value ||
      ''
    ).toLowerCase();


  $('#armoryTable').innerHTML =
    items
      .filter(i =>
        JSON.stringify(i)
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 300)
      .map(i =>
        `
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
            ${esc(
              i.id ?? '—'
            )}
          </td>

        </tr>
        `
      )
      .join('') ||

    `
      <tr>
        <td colspan="4">
          Armory inventory is unavailable
          from this API selection.
        </td>
      </tr>
    `;
}


/* -------------------------------------------------------
   WAR
------------------------------------------------------- */

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


  $('#warBadge').textContent =
    r &&
    Object.keys(r).length
      ? 'DATA'
      : 'NO ACTIVE DATA';


  $('#warInfo').innerHTML =
    entries
      .map(([k, v]) =>
        `
        <div class="list-row">
          <span>
            ${esc(
              k.replaceAll(
                '_',
                ' '
              )
            )}
          </span>
          <b>${esc(v)}</b>
        </div>
        `
      )
      .join('') ||

    `
      <div class="empty">
        No ranked-war data returned.
      </div>
    `;
}


/* -------------------------------------------------------
   TERRITORY
------------------------------------------------------- */

function renderTerritory(t) {

  const entries =
    Object.entries(t || {})
      .filter(
        ([, v]) =>
          typeof v !== 'object'
      )
      .slice(0, 24);


  $('#territoryInfo').innerHTML =
    entries
      .map(([k, v]) =>
        `
        <div class="list-row">
          <span>
            ${esc(
              k.replaceAll(
                '_',
                ' '
              )
            )}
          </span>

          <b>${esc(v)}</b>
        </div>
        `
      )
      .join('') ||

    `
      <div class="empty">
        No territory data returned.
      </div>
    `;
}


/* -------------------------------------------------------
   UPGRADES
------------------------------------------------------- */

function renderUpgrades(us) {

  $('#upgradesInfo').innerHTML =
    us
      .map(u =>
        `
        <div class="upgrade-card">

          <b>
            ${esc(
              u.name ||
              u.upgrade ||
              u.id
            )}
          </b>

          <span>
            Level
            ${esc(
              u.level ??
              u.current_level ??
              '—'
            )}
          </span>

        </div>
        `
      )
      .join('') ||

    `
      <div class="empty">
        No upgrade records returned.
      </div>
    `;
}


/* -------------------------------------------------------
   GENERIC TABLES
------------------------------------------------------- */

function renderGeneric(id, data) {

  const el =
    $('#' + id);

  const rows =
    arr(data);

  if (!rows.length) {

    el.innerHTML =
      `
      <div class="empty">
        No data returned for this feed.
      </div>
      `;

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
        k => k !== 'id'
      )
      .slice(0, 4);


  el.innerHTML =
    `
    <table>

      <thead>

        <tr>
          ${cols
            .map(c =>
              `<th>
                ${esc(
                  c.replaceAll(
                    '_',
                    ' '
                  )
                )}
              </th>`
            )
            .join('')}
        </tr>

      </thead>

      <tbody>

        ${
          sample
            .map(o =>
              `
              <tr>

                ${
                  cols
                    .map(c => {

                      let value;

                      if (
                        typeof o ===
                        'object'
                      ) {

                        value =
                          typeof o[c] ===
                          'object'
                            ? JSON.stringify(
                                o[c]
                              )
                            : o[c];

                      } else {

                        value = o;
                      }

                      return `
                        <td>
                          ${esc(value)}
                        </td>
                      `;

                    })
                    .join('')
                }

              </tr>
              `
            )
            .join('')
        }

      </tbody>

    </table>
    `;
}


/* -------------------------------------------------------
   LOAD
------------------------------------------------------- */

async function load() {

  const error =
    $('#error');

  error.classList.add(
    'hidden'
  );

  $('#statusLine').textContent =
    'Syncing…';

  $('#liveDot').className =
    'sync';


  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      15000
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


    let json;

    try {

      json =
        await response.json();

    } catch {

      throw new Error(
        `Server returned HTTP ${response.status} with invalid JSON`
      );
    }


    if (!response.ok) {

      throw new Error(
        json.error ||
        `HTTP ${response.status}`
      );
    }


    render(json);


    $('#statusLine').textContent =
      json._meta?.cached
        ? 'Live • database'
        : 'Live • synchronized';

    $('#liveDot').className =
      '';


    if (
      json._meta?.partial_failures?.length
    ) {

      error.textContent =
        `Some Torn feeds were unavailable: ${
          json._meta.partial_failures.join(
            ' • '
          )
        }`;

      error.classList.remove(
        'hidden'
      );
    }


  } catch (x) {

    const msg =
      x?.name === 'AbortError'
        ? 'Dashboard request timed out after 15 seconds.'
        : (
            x?.message ||
            String(x)
          );


    error.textContent =
      `Could not load Torn data: ${msg}`;

    error.classList.remove(
      'hidden'
    );

    $('#statusLine').textContent =
      'API unavailable';

    $('#liveDot').className =
      'bad';

    console.error(x);


  } finally {

    clearTimeout(timer);

  }
}


/* -------------------------------------------------------
   NAVIGATION
------------------------------------------------------- */

setLinks();


document
  .querySelectorAll('.nav')
  .forEach(button => {

    button.addEventListener(
      'click',
      () => {

        /*
         * Only one .tab-panel can be active.
         * Because the Chain tab now has a unique
         * section ID, it cannot conflict with
         * the Command Chain KPI.
         */

        document
          .querySelectorAll(
            '.nav,.tab-panel'
          )
          .forEach(
            element =>
              element.classList.remove(
                'active'
              )
          );


        button.classList.add(
          'active'
        );


        const target =
          document.getElementById(
            button.dataset.tab
          );

        if (target) {

          target.classList.add(
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


/* -------------------------------------------------------
   SEARCH / REFRESH
------------------------------------------------------- */

$('#refreshBtn').onclick =
  load;


$('#memberSearch').addEventListener(
  'input',
  () =>
    renderMembers(
      arr(
        DATA.members?.members ||
        DATA.members
      )
    )
);


$('#armorySearch').addEventListener(
  'input',
  () =>
    renderArmory(
      arr(
        DATA.armory?.items ||
        DATA.armory
      )
    )
);


/* -------------------------------------------------------
   INITIAL LOAD
------------------------------------------------------- */

load();


/* Refresh database data every 5 minutes. */
setInterval(
  load,
  CONFIG.refreshMs
);


/* Keep the live chain timer updating. */
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
