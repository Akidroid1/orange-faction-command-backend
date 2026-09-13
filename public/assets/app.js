const CONFIG = {
  factionId: 53295,
  discordInvite: 'https://discord.gg/duHJkWRRT',
  tornStats: 'https://www.tornstats.com/factions/53295',
  refreshMs: 300000,
  chainRefreshMs: 5000
};

const $ = selector =>
  document.querySelector(selector);

const fmt = value => {
  if (
    value == null ||
    value === '' ||
    Number.isNaN(Number(value))
  ) {
    return '—';
  }

  return Number(value).toLocaleString();
};

const esc = value =>
  String(value ?? '').replace(
    /[&<>"']/g,
    char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[char])
  );

function get(object, ...paths) {
  for (const path of paths) {
    const value = path
      .split('.')
      .reduce(
        (result, key) =>
          result?.[key],
        object
      );

    if (
      value !== undefined &&
      value !== null
    ) {
      return value;
    }
  }

  return undefined;
}

function arr(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (
    value &&
    typeof value === 'object'
  ) {
    return Object.values(value);
  }

  return [];
}

let DATA = {};
let LIVE_CHAIN = null;

const tornUrl =
  `https://www.torn.com/factions.php?step=profile&ID=${CONFIG.factionId}`;

const pdaUrl =
  `tornpda://factions.php?step=profile&ID=${CONFIG.factionId}`;


/* =========================
   LINKS
========================= */

function setLinks() {

  const links = {
    tornBtn: tornUrl,
    heroTorn: tornUrl,
    pdaBtn: pdaUrl,
    heroPda: pdaUrl,
    discordBtn: CONFIG.discordInvite,
    heroDiscord: CONFIG.discordInvite,
    statsBtn: CONFIG.tornStats
  };

  Object.entries(links).forEach(
    ([id, url]) => {

      const element =
        $('#' + id);

      if (element) {
        element.href = url;
      }

    }
  );
}


/* =========================
   GENERAL HELPERS
========================= */

function formatTime(value) {

  if (
    value == null ||
    value === ''
  ) {
    return '—';
  }

  const number =
    Number(value);

  if (
    Number.isFinite(number) &&
    number > 1000000000
  ) {
    return new Date(
      number * 1000
    ).toLocaleString();
  }

  return String(value);
}


function formatAge(days) {

  const number =
    Number(days);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return '—';
  }

  const years =
    Math.floor(number / 365);

  const months =
    Math.floor(
      (number % 365) / 30
    );

  const remaining =
    number % 30;

  const parts = [];

  if (years) {
    parts.push(`${years}y`);
  }

  if (months) {
    parts.push(`${months}m`);
  }

  if (
    remaining ||
    !parts.length
  ) {
    parts.push(`${remaining}d`);
  }

  return `${parts.join(' ')} (${fmt(number)} days)`;
}


function formatDuration(seconds) {

  let value =
    Math.max(
      0,
      Math.floor(
        Number(seconds) || 0
      )
    );

  const days =
    Math.floor(
      value / 86400
    );

  value %= 86400;

  const hours =
    Math.floor(
      value / 3600
    );

  value %= 3600;

  const minutes =
    Math.floor(
      value / 60
    );

  const secs =
    value % 60;

  const parts = [];

  if (days) {
    parts.push(`${days}d`);
  }

  if (hours) {
    parts.push(`${hours}h`);
  }

  if (minutes) {
    parts.push(`${minutes}m`);
  }

  parts.push(`${secs}s`);

  return parts.join(' ');
}


/* =========================
   FACTION INFO
========================= */

function factionRank(basic) {

  const rank =
    get(
      basic,
      'rank',
      'faction_rank'
    );

  if (!rank) {
    return '—';
  }

  if (
    typeof rank === 'string'
  ) {
    return rank;
  }

  const name =
    rank.name ||
    rank.rank ||
    rank.title;

  const division =
    rank.division;

  if (
    name &&
    division != null
  ) {
    return `${name} ${division}`;
  }

  return name || '—';
}


function leaderName(
  basic,
  members
) {

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

    if (
      leader.name ||
      leader.username
    ) {
      return (
        leader.name ||
        leader.username
      );
    }

    const id =
      leader.id ??
      leader.user_id ??
      leader.player_id;

    if (id) {

      const member =
        members.find(
          member =>
            String(
              member.id ??
              member.user_id ??
              member.player_id
            ) ===
            String(id)
        );

      return (
        member?.name ||
        member?.username ||
        String(id)
      );
    }
  }

  if (
    leader != null
  ) {

    const member =
      members.find(
        member =>
          String(
            member.id ??
            member.user_id ??
            member.player_id
          ) ===
          String(leader)
      );

    return (
      member?.name ||
      member?.username ||
      String(leader)
    );
  }

  return '—';
}


/* =========================
   CHAIN
========================= */

function chainState(chain) {

  const current =
    Number(
      get(
        chain,
        'current',
        'current_chain',
        'chain'
      )
    ) || 0;

  const max =
    Number(
      get(
        chain,
        'max',
        'max_chain'
      )
    ) || 0;

  const timeout =
    Number(
      get(
        chain,
        'timeout'
      )
    ) || 0;

  const cooldown =
    Number(
      get(
        chain,
        'cooldown'
      )
    ) || 0;

  const now =
    Math.floor(
      Date.now() / 1000
    );

  return {
    current,
    max,
    timeout,
    cooldown,
    cooldownRemaining:
      cooldown > now
        ? cooldown - now
        : 0
  };
}


function nextChainMilestone(
  current
) {

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
    milestone =>
      milestone > current
  ) || null;
}


function renderChain(chain) {

  const state =
    chainState(
      chain || {}
    );

  const next =
    nextChainMilestone(
      state.current
    );

  const active =
    state.current > 0 &&
    state.cooldownRemaining === 0;

  const cooldown =
    state.cooldownRemaining > 0;

  const phase =
    cooldown
      ? 'COOLDOWN'
      : active
        ? 'ACTIVE'
        : 'WAITING';


  /* Command KPI */

  const commandChain =
    $('#commandChain');

  if (commandChain) {
    commandChain.textContent =
      fmt(state.current);
  }


  /* Chain page */

  const chainBig =
    $('#chainBig');

  if (chainBig) {
    chainBig.textContent =
      fmt(state.current);
  }


  const phaseElement =
    $('#chainPhase');

  if (phaseElement) {

    phaseElement.textContent =
      phase;

    phaseElement.className =
      `chain-phase ${phase.toLowerCase()}`;
  }


  const bar =
    $('#chainBar');

  if (bar) {

    const percentage =
      state.max > 0
        ? Math.min(
            100,
            (
              state.current /
              state.max
            ) * 100
          )
        : 0;

    bar.style.width =
      `${percentage}%`;
  }


  const timeoutElement =
    $('#chainTimeout');

  if (timeoutElement) {

    timeoutElement.textContent =
      state.timeout > 0
        ? `Next hit ${formatDuration(
            state.timeout
          )}`
        : active
          ? 'Chain active'
          : 'Next hit —';
  }


  const cooldownElement =
    $('#chainCooldown');

  if (cooldownElement) {

    cooldownElement.textContent =
      cooldown
        ? `Cooldown ${formatDuration(
            state.cooldownRemaining
          )}`
        : 'Cooldown —';
  }


  const details =
    $('#chainDetails');

  if (details) {

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
        state.timeout
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
        get(chain, 'id') ?? '—'
      ],

      [
        'Modifier',
        get(chain, 'modifier') ?? '—'
      ],

      [
        'Started',
        formatTime(
          get(
            chain,
            'start',
            'started_at'
          )
        )
      ],

      [
        'Ends',
        formatTime(
          get(
            chain,
            'end',
            'ended_at'
          )
        )
      ]

    ];

    details.innerHTML =
      rows
        .map(
          row =>
            `<div class="list-row">
              <span>${esc(row[0])}</span>
              <b>${esc(row[1])}</b>
            </div>`
        )
        .join('');
  }
}


/* =========================
   PREVIOUS CHAINS
========================= */

function normalizeCompletedChains(
  source
) {

  if (!source) {
    return [];
  }

  /*
   * Torn may return completed chains
   * as an array, an object keyed by ID,
   * or a nested object.
   */

  if (
    Array.isArray(source)
  ) {
    return source;
  }

  if (
    source.chains
  ) {
    return arr(
      source.chains
    );
  }

  if (
    source.data?.chains
  ) {
    return arr(
      source.data.chains
    );
  }

  if (
    typeof source === 'object'
  ) {
    return Object.values(
      source
    );
  }

  return [];
}


function chainRecordValue(
  chain,
  ...paths
) {

  return get(
    chain,
    ...paths
  );
}


function renderCompletedChains(
  source
) {

  const chains =
    normalizeCompletedChains(
      source
    );

  let container =
    $('#completedChains');


  /*
   * Create the Previous Chains
   * panel underneath the current
   * chain section if it isn't already
   * present in index.html.
   */

  if (!container) {

    const chainSection =
      $('#chain');

    if (!chainSection) {
      return;
    }

    container =
      document.createElement(
        'article'
      );

    container.id =
      'completedChains';

    container.className =
      'panel';

    container.style.marginTop =
      '18px';

    chainSection.appendChild(
      container
    );
  }


  const sorted =
    [...chains]
      .sort(
        (a, b) => {

          const aTime =
            Number(
              chainRecordValue(
                a,
                'end',
                'ended_at',
                'completed_at'
              )
            ) || 0;

          const bTime =
            Number(
              chainRecordValue(
                b,
                'end',
                'ended_at',
                'completed_at'
              )
            ) || 0;

          return bTime - aTime;
        }
      );


  container.innerHTML = `

    <div class="panel-head">

      <div>
        <h2>Previous Chains</h2>

        <span class="muted">
          Completed faction chains
        </span>
      </div>

      <span>
        ${fmt(sorted.length)}
      </span>

    </div>

    ${
      sorted.length
        ? `

          <div class="table-wrap">

            <table>

              <thead>

                <tr>
                  <th>Chain</th>
                  <th>Chain ID</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Duration</th>
                </tr>

              </thead>

              <tbody>

                ${sorted
                  .slice(0, 100)
                  .map(
                    chain => {

                      const count =
                        chainRecordValue(
                          chain,
                          'chain',
                          'count',
                          'hits',
                          'total',
                          'chain_length',
                          'length'
                        );

                      const id =
                        chainRecordValue(
                          chain,
                          'id',
                          'chain_id'
                        );

                      const start =
                        chainRecordValue(
                          chain,
                          'start',
                          'started_at',
                          'start_time'
                        );

                      const end =
                        chainRecordValue(
                          chain,
                          'end',
                          'ended_at',
                          'end_time',
                          'completed_at'
                        );

                      let duration =
                        chainRecordValue(
                          chain,
                          'duration'
                        );

                      if (
                        duration == null &&
                        Number(start) &&
                        Number(end)
                      ) {
                        duration =
                          formatDuration(
                            Number(end) -
                            Number(start)
                          );
                      }

                      return `

                        <tr>

                          <td>
                            <b>
                              ${esc(
                                fmt(
                                  count
                                )
                              )}
                            </b>
                          </td>

                          <td>
                            ${esc(
                              id ?? '—'
                            )}
                          </td>

                          <td>
                            ${esc(
                              formatTime(
                                start
                              )
                            )}
                          </td>

                          <td>
                            ${esc(
                              formatTime(
                                end
                              )
                            )}
                          </td>

                          <td>
                            ${esc(
                              duration ??
                              '—'
                            )}
                          </td>

                        </tr>

                      `;
                    }
                  )
                  .join('')}

              </tbody>

            </table>

          </div>

        `
        : `

          <div style="
            padding:18px;
            color:#777;
          ">
            No completed chains returned.
          </div>

        `
    }

  `;
}


/* =========================
   READINESS
========================= */

function calculateReadiness(
  members,
  crimes,
  chain,
  rankedWar
) {

  const memberCount =
    members.length;

  const activeMembers =
    stateCount(
      members
    );

  const chainValue =
    Number(
      get(
        chain,
        'current'
      )
    ) || 0;

  const memberScore =
    memberCount > 0
      ? Math.min(
          1,
          activeMembers /
          memberCount
        ) * 40
      : 0;

  const chainScore =
    Math.min(
      1,
      chainValue / 100
    ) * 40;

  const warScore =
    rankedWar
      ? 20
      : 0;

  return Math.min(
    100,
    Math.round(
      memberScore +
      chainScore +
      warScore
    )
  );
}


function renderReadiness(
  members,
  crimes,
  chain,
  rankedWar
) {

  const readiness =
    calculateReadiness(
      members,
      crimes,
      chain,
      rankedWar
    );

  if ($('#readiness')) {
    $('#readiness').textContent =
      `${readiness}%`;
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
      `${members.length} members tracked • ` +
      `${crimes.length} OC records • ` +
      `${fmt(
        get(
          chain,
          'current'
        ) || 0
      )} current chain`;
  }
}


/* =========================
   MEMBER STATUS
========================= */

function stateCount(
  members
) {

  return members.filter(
    member => {

      const state =
        String(
          get(
            member,
            'status.state',
            'status',
            'state'
          ) || ''
        ).toLowerCase();

      return [
        'online',
        'okay',
        'active'
      ].includes(state);
    }
  ).length;
}


function memberLife(
  member
) {

  const current =
    get(
      member,
      'life.current',
      'life.current_life',
      'life.value'
    );

  const maximum =
    get(
      member,
      'life.maximum',
      'life.max',
      'life.max_life'
    );

  if (
    current == null &&
    maximum == null
  ) {
    return '—';
  }

  if (
    current != null &&
    maximum != null
  ) {
    return `${fmt(current)} / ${fmt(maximum)}`;
  }

  return fmt(
    current ?? maximum
  );
}


function memberStatus(
  member
) {

  return String(
    get(
      member,
      'status.state',
      'status',
      'state'
    ) || '—'
  );
}


/* =========================
   MAIN RENDER
========================= */

function render(data) {

  DATA = data;

  const basic =
    data.basic || {};

  const members =
    arr(
      data.members?.members ||
      data.members
    );

  const crimes =
    arr(
      data.crimes?.crimes ||
      data.crimes
    );

  const armory =
    arr(
      data.armory?.items ||
      data.armory
    );

  const chain =
    data.chain || {};

  const rankedWar =
    data.rankedwar ||
    data.rankedwars ||
    null;


  const name =
    basic.name ||
    'ORANGE';


  /* Header */

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


  /* Statistics */

  const respect =
    get(
      basic,
      'respect',
      'respect_value'
    );

  const capacity =
    get(
      basic,
      'capacity'
    );

  const rank =
    factionRank(
      basic
    );

  const leader =
    leaderName(
      basic,
      members
    );

  const age =
    formatAge(
      get(
        basic,
        'days_old'
      )
    );


  if ($('#respect')) {
    $('#respect').textContent =
      fmt(respect);
  }

  if ($('#membersCount')) {
    $('#membersCount').textContent =
      fmt(
        get(
          basic,
          'members',
          'member_count'
        ) ??
        members.length
      );
  }

  if ($('#capacitySmall')) {
    $('#capacitySmall').textContent =
      `Capacity ${fmt(capacity)}`;
  }

  if ($('#rank')) {
    $('#rank').textContent =
      rank;
  }

  if ($('#ocCount')) {
    $('#ocCount').textContent =
      fmt(crimes.length);
  }

  if ($('#onlineCount')) {
    $('#onlineCount').textContent =
      fmt(
        stateCount(
          members
        )
      );
  }


  /* Faction Intel */

  if ($('#factionInfo')) {

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
        age
      ],

      [
        'Members',
        `${members.length}${
          capacity
            ? ` / ${capacity}`
            : ''
        }`
      ]

    ];

    $('#factionInfo').innerHTML =
      info
        .map(
          row =>
            `<div>
              <span>${esc(row[0])}</span>
              <b>${esc(row[1])}</b>
            </div>`
        )
        .join('');
  }


  /* Current chain */

  renderChain(
    chain
  );


  /* Previous chains */

  /*
   * The normal faction endpoint also
   * supplies completed chains.
   */

  const completedChains =
    data.chains ||
    data.history ||
    [];

  renderCompletedChains(
    completedChains
  );


  /* Readiness */

  renderReadiness(
    members,
    crimes,
    chain,
    rankedWar
  );


  /* Operations */

  if ($('#liveInfo')) {

    $('#liveInfo').innerHTML = [

      [
        'Roster',
        `${members.length} members / ${stateCount(members)} active`
      ],

      [
        'Organized crimes',
        crimes.length
      ],

      [
        'Armory records',
        armory.length
      ],

      [
        'Current chain',
        fmt(
          get(
            chain,
            'current'
          ) || 0
        )
      ],

      [
        'Completed chains',
        normalizeCompletedChains(
          completedChains
        ).length
      ],

      [
        'Ranked war',
        rankedWar
          ? 'Available'
          : 'Unavailable'
      ],

      [
        'Territory',
        data.territory
          ? 'Available'
          : 'Unavailable'
      ]

    ]
      .map(
        row =>
          `<div class="feed-row">
            <span>${esc(row[0])}</span>
            <b>${esc(row[1])}</b>
          </div>`
      )
      .join('');
  }


  /* Coverage */

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
    'revives'
  ];

  if ($('#coverage')) {
    $('#coverage').textContent =
      `${keys.filter(
        key => data[key]
      ).length}/${keys.length}`;
  }

  if ($('#coverageInfo')) {

    $('#coverageInfo').innerHTML =
      keys
        .map(
          key =>
            `<div class="coverage-row">
              <span>${esc(key)}</span>
              <i class="${data[key] ? 'ok' : 'no'}">
                ${data[key] ? '●' : '○'}
              </i>
            </div>`
        )
        .join('');
  }


  renderMembers(
    members
  );

  renderCrimes(
    crimes
  );

  renderArmory(
    armory
  );

  renderWar(
    rankedWar || {}
  );

  renderTerritory(
    data.territory || {}
  );

  renderUpgrades(
    arr(
      data.upgrades?.upgrades ||
      data.upgrades
    )
  );

  renderGeneric(
    'applicationsInfo',
    data.applications
  );

  renderGeneric(
    'reportsInfo',
    data.reports
  );

  renderGeneric(
    'attacksInfo',
    data.attacks
  );

  renderGeneric(
    'revivesInfo',
    data.revives
  );

  renderGeneric(
    'contributorsInfo',
    data.contributors
  );

  renderGeneric(
    'donationsInfo',
    data.donations
  );


  const now =
    new Date()
      .toLocaleTimeString();

  [
    'updated',
    'footerUpdated',
    'feedTime'
  ].forEach(
    id => {

      const element =
        $('#' + id);

      if (element) {
        element.textContent =
          now;
      }

    }
  );
}


/* =========================
   MEMBERS
========================= */

function renderMembers(
  members
) {

  const table =
    $('#membersTable');

  if (!table) {
    return;
  }

  const query =
    (
      $('#memberSearch')?.value ||
      ''
    ).toLowerCase();

  const rows =
    members.filter(
      member =>
        JSON.stringify(
          member
        )
          .toLowerCase()
          .includes(query)
    );

  table.innerHTML =
    rows
      .map(
        member => {

          const status =
            memberStatus(
              member
            );

          const last =
            get(
              member,
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
                  href="https://www.torn.com/profiles.php?XID=${encodeURIComponent(
                    member.id
                  )}"
                  target="_blank"
                  rel="noopener"
                >
                  ${esc(
                    member.name ||
                    member.username ||
                    member.id
                  )}
                </a>
              </td>

              <td>
                ${esc(
                  member.level ?? '—'
                )}
              </td>

              <td>
                ${esc(
                  get(
                    member,
                    'position.name',
                    'position',
                    'role'
                  ) || '—'
                )}
              </td>

              <td>
                ${esc(
                  memberLife(
                    member
                  )
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
        }
      )
      .join('') ||
    '<tr><td colspan="6">No member data returned.</td></tr>';
}


/* =========================
   CRIMES
========================= */

function renderCrimes(
  crimes
) {

  if (!$('#crimesTable')) {
    return;
  }

  if ($('#ocNote')) {
    $('#ocNote').textContent =
      `${crimes.length} records`;
  }

  $('#crimesTable').innerHTML =
    crimes
      .slice(0, 150)
      .map(
        crime =>
          `<tr>
            <td>
              ${esc(
                crime.name ||
                crime.crime_name ||
                crime.id ||
                'OC'
              )}
            </td>

            <td>
              <span class="pill">
                ${esc(
                  crime.status ||
                  crime.state ||
                  '—'
                )}
              </span>
            </td>

            <td>
              ${esc(
                formatTime(
                  crime.created_at ||
                  crime.created
                )
              )}
            </td>

            <td>
              ${fmt(
                arr(
                  crime.participants ||
                  crime.slots
                ).length
              )}
            </td>

            <td>
              ${esc(
                crime.difficulty ||
                crime.success ||
                '—'
              )}
            </td>
          </tr>`
      )
      .join('') ||
    '<tr><td colspan="5">No OC data returned.</td></tr>';
}


/* =========================
   ARMORY
========================= */

function renderArmory(
  items
) {

  const table =
    $('#armoryTable');

  if (!table) {
    return;
  }

  const query =
    (
      $('#armorySearch')?.value ||
      ''
    ).toLowerCase();

  table.innerHTML =
    items
      .filter(
        item =>
          JSON.stringify(
            item
          )
            .toLowerCase()
            .includes(query)
      )
      .slice(0, 300)
      .map(
        item =>
          `<tr>
            <td>
              ${esc(
                item.name ||
                item.item_name ||
                item.id ||
                'Item'
              )}
            </td>

            <td>
              ${esc(
                item.type ||
                item.category ||
                '—'
              )}
            </td>

            <td>
              ${fmt(
                item.quantity ??
                item.qty ??
                item.amount
              )}
            </td>

            <td>
              ${esc(
                item.id ?? '—'
              )}
            </td>
          </tr>`
      )
      .join('') ||
    '<tr><td colspan="4">Armory inventory is unavailable.</td></tr>';
}


/* =========================
   WAR / TERRITORY
========================= */

function renderWar(
  war
) {

  const container =
    $('#warInfo');

  if (!container) {
    return;
  }

  const record =
    get(
      war,
      'war',
      'current',
      'rankedwar'
    ) || war;

  const entries =
    Object.entries(
      record || {}
    )
      .filter(
        ([, value]) =>
          typeof value !== 'object'
      )
      .slice(0, 24);

  if ($('#warBadge')) {
    $('#warBadge').textContent =
      entries.length
        ? 'DATA'
        : 'NO ACTIVE DATA';
  }

  container.innerHTML =
    entries
      .map(
        ([key, value]) =>
          `<div class="list-row">
            <span>${esc(
              key.replaceAll(
                '_',
                ' '
              )
            )}</span>
            <b>${esc(value)}</b>
          </div>`
      )
      .join('') ||
    '<div class="empty">No ranked-war data returned.</div>';
}


function renderTerritory(
  territory
) {

  const container =
    $('#territoryInfo');

  if (!container) {
    return;
  }

  const entries =
    Object.entries(
      territory || {}
    )
      .filter(
        ([, value]) =>
          typeof value !== 'object'
      )
      .slice(0, 24);

  container.innerHTML =
    entries
      .map(
        ([key, value]) =>
          `<div class="list-row">
            <span>${esc(
              key.replaceAll(
                '_',
                ' '
              )
            )}</span>
            <b>${esc(value)}</b>
          </div>`
      )
      .join('') ||
    '<div class="empty">No territory data returned.</div>';
}


/* =========================
   UPGRADES
========================= */

function renderUpgrades(
  upgrades
) {

  const container =
    $('#upgradesInfo');

  if (!container) {
    return;
  }

  container.innerHTML =
    upgrades
      .map(
        upgrade =>
          `<div class="upgrade-card">
            <b>${esc(
              upgrade.name ||
              upgrade.upgrade ||
              upgrade.id
            )}</b>

            <span>
              Level ${esc(
                upgrade.level ??
                upgrade.current_level ??
                '—'
              )}
            </span>
          </div>`
      )
      .join('') ||
    '<div class="empty">No upgrade records returned.</div>';
}


/* =========================
   GENERIC FEEDS
========================= */

function renderGeneric(
  id,
  data
) {

  const element =
    $('#' + id);

  if (!element) {
    return;
  }

  const rows =
    arr(data);

  if (!rows.length) {

    element.innerHTML =
      '<div class="empty">No data returned for this feed.</div>';

    return;
  }

  const sample =
    rows.slice(0, 12);

  const columns =
    [
      ...new Set(
        sample.flatMap(
          object =>
            typeof object === 'object'
              ? Object.keys(object)
              : ['value']
        )
      )
    ]
      .filter(
        key => key !== 'id'
      )
      .slice(0, 4);

  element.innerHTML =
    `<table>

      <thead>

        <tr>
          ${columns
            .map(
              column =>
                `<th>${esc(
                  column.replaceAll(
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
            object =>
              `<tr>

                ${columns
                  .map(
                    column =>
                      `<td>${esc(
                        typeof object === 'object'
                          ? typeof object[column] === 'object'
                            ? JSON.stringify(
                                object[column]
                              )
                            : object[column]
                          : object
                      )}</td>`
                  )
                  .join('')}

              </tr>`
          )
          .join('')}

      </tbody>

    </table>`;
}


/* =========================
   LOAD FACTION
========================= */

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

    if (
      data._meta?.partial_failures?.length &&
      error
    ) {

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

  } catch (exception) {

    console.error(
      'Faction load failed:',
      exception
    );

    if (error) {

      error.textContent =
        `Could not load Torn data: ${exception.message}`;

      error.classList.remove(
        'hidden'
      );
    }

    if ($('#statusLine')) {
      $('#statusLine').textContent =
        'API unavailable';
    }
  }
}


/* =========================
   LIVE CHAIN
========================= */

async function loadLiveChain() {

  try {

    const response =
      await fetch(
        `/api/chain?faction_id=${CONFIG.factionId}`,
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

    LIVE_CHAIN =
      data;


    /* Current chain */

    renderChain(
      data.chain || {}
    );


    /*
     * Previous chains from the
     * live chain endpoint.
     *
     * We deliberately render them
     * here too, so the Chain page
     * doesn't depend on the 5-minute
     * faction refresh.
     */

    const previousChains =
      data.chains ||
      data.history ||
      [];

    renderCompletedChains(
      previousChains
    );


    /*
     * Keep readiness synchronized
     * with the live chain.
     */

    if (
      DATA &&
      Object.keys(DATA).length
    ) {

      renderReadiness(
        arr(
          DATA.members?.members ||
          DATA.members
        ),

        arr(
          DATA.crimes?.crimes ||
          DATA.crimes
        ),

        data.chain || {},

        DATA.rankedwar ||
        DATA.rankedwars ||
        null
      );
    }

  } catch (error) {

    console.error(
      'Live chain load failed:',
      error
    );
  }
}


/* =========================
   NAVIGATION
========================= */

setLinks();


document
  .querySelectorAll('.nav')
  .forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

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

          const panel =
            document.getElementById(
              button.dataset.tab
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

    }
  );


/* Refresh */

if ($('#refreshBtn')) {
  $('#refreshBtn').onclick =
    load;
}


/* Member search */

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


/* Armory search */

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


/* =========================
   START
========================= */

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
