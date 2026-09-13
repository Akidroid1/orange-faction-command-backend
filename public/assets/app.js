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

const get = (o, ...paths) => {
  for (const path of paths) {
    const value =
      path
        .split('.')
        .reduce(
          (a, k) => a?.[k],
          o
        );

    if (
      value !== undefined &&
      value !== null
    ) {
      return value;
    }
  }

  return undefined;
};

const arr = v => {
  if (Array.isArray(v)) return v;

  if (
    v &&
    typeof v === 'object'
  ) {
    return Object.values(v);
  }

  return [];
};

let DATA = {};
let LIVE_CHAIN = null;

const tornUrl =
  `https://www.torn.com/factions.php?step=profile&ID=${CONFIG.factionId}`;

const pdaUrl =
  `tornpda://factions.php?step=profile&ID=${CONFIG.factionId}`;

function setLinks() {
  const links = {
    tornBtn: tornUrl,
    heroTorn: tornUrl,
    pdaBtn: pdaUrl,
    heroPda: pdaUrl,
    discordBtn:
      CONFIG.discordInvite,
    heroDiscord:
      CONFIG.discordInvite,
    statsBtn:
      CONFIG.tornStats
  };

  Object.entries(links)
    .forEach(
      ([id, url]) => {
        const el =
          $('#' + id);

        if (el) {
          el.href = url;
        }
      }
    );
}

function formatAge(days) {
  const n =
    Number(days);

  if (
    !Number.isFinite(n) ||
    n < 0
  ) {
    return '—';
  }

  const years =
    Math.floor(
      n / 365
    );

  const months =
    Math.floor(
      (n % 365) / 30
    );

  const remainingDays =
    n % 30;

  const parts = [];

  if (years) {
    parts.push(
      `${years}y`
    );
  }

  if (months) {
    parts.push(
      `${months}m`
    );
  }

  if (
    remainingDays ||
    !parts.length
  ) {
    parts.push(
      `${remainingDays}d`
    );
  }

  return `${parts.join(' ')} (${fmt(n)} days)`;
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
          m =>
            String(
              m.id ??
              m.user_id ??
              m.player_id
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
        m =>
          String(
            m.id ??
            m.user_id ??
            m.player_id
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

/*
 * Torn faction basic.rank:
 *
 * level    = internal rank level
 * name     = Silver
 * division = the PUBLIC division
 *
 * We want "Silver 1", not "Silver 7".
 */
function factionRank(
  basic
) {
  const rank =
    get(
      basic,
      'rank',
      'faction_rank'
    );

  if (
    !rank ||
    typeof rank !== 'object'
  ) {
    return (
      typeof rank === 'string'
        ? rank
        : '—'
    );
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

  return (
    name ||
    '—'
  );
}

function formatTime(
  value
) {
  if (
    value == null ||
    value === ''
  ) {
    return '—';
  }

  const n =
    Number(value);

  if (
    Number.isFinite(n) &&
    n > 1000000000
  ) {
    return new Date(
      n * 1000
    ).toLocaleString();
  }

  return String(value);
}

function chainState(
  chain
) {
  const current =
    Number(
      get(
        chain,
        'current',
        'current_chain'
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

function formatDuration(
  seconds
) {
  let n =
    Math.max(
      0,
      Math.floor(
        Number(seconds) || 0
      )
    );

  const d =
    Math.floor(
      n / 86400
    );

  n %= 86400;

  const h =
    Math.floor(
      n / 3600
    );

  n %= 3600;

  const m =
    Math.floor(
      n / 60
    );

  const s =
    n % 60;

  const parts = [];

  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);

  parts.push(`${s}s`);

  return parts.join(' ');
}

function renderChain(
  chain
) {
  const state =
    chainState(
      chain || {}
    );

  if ($('#chain')) {
    $('#chain').textContent =
      fmt(state.current);
  }

  if ($('#chainBig')) {
    $('#chainBig').textContent =
      fmt(state.current);
  }

  if ($('#chainBar')) {
    $('#chainBar').style.width =
      state.max
        ? `${Math.min(
            100,
            (
              state.current /
              state.max
            ) * 100
          )}%`
        : '0%';
  }

  if ($('#chainPhase')) {
    const active =
      state.current > 0 &&
      state.timeout > 0;

    const cooldown =
      state.cooldownRemaining > 0;

    const phase =
      cooldown
        ? 'COOLDOWN'
        : active
          ? 'ACTIVE'
          : 'WAITING';

    $('#chainPhase').textContent =
      phase;

    $('#chainPhase').className =
      `chain-phase ${phase.toLowerCase()}`;
  }

  if ($('#chainTimeout')) {
    $('#chainTimeout').textContent =
      state.timeout > 0
        ? `Next hit ${formatDuration(
            state.timeout
          )}`
        : 'Next hit —';
  }

  if ($('#chainCooldown')) {
    $('#chainCooldown').textContent =
      state.cooldownRemaining > 0
        ? `Cooldown ${formatDuration(
            state.cooldownRemaining
          )}`
        : 'Cooldown —';
  }

  if ($('#chainDetails')) {
    const rows = [
      [
        'Current chain',
        fmt(state.current)
      ],
      [
        'Maximum',
        fmt(state.max)
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
        state.cooldownRemaining
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

    $('#chainDetails').innerHTML =
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

  renderCompletedChains(
    LIVE_CHAIN?.chains ||
    LIVE_CHAIN?.history ||
    []
  );
}

function renderCompletedChains(
  chains
) {
  const list =
    Array.isArray(chains)
      ? chains
      : arr(chains);

  let container =
    $('#completedChains');

  if (!container) {
    const chainSection =
      document.querySelector(
        '#chain'
      );

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

  container.innerHTML = `
    <div class="panel-head">
      <div>
        <h2>Previous Chains</h2>
        <span class="muted">
          Completed faction chains
        </span>
      </div>

      <span>
        ${fmt(list.length)}
      </span>
    </div>

    ${
      list.length
        ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Chain</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Duration</th>
                </tr>
              </thead>

              <tbody>
                ${list
                  .slice(0, 50)
                  .map(
                    c => `
                      <tr>
                        <td>
                          <b>
                            ${esc(
                              fmt(
                                get(
                                  c,
                                  'chain',
                                  'count',
                                  'hits',
                                  'total'
                                )
                              )
                            )}
                          </b>
                        </td>

                        <td>
                          ${esc(
                            formatTime(
                              get(
                                c,
                                'start',
                                'started_at'
                              )
                            )
                          )}
                        </td>

                        <td>
                          ${esc(
                            formatTime(
                              get(
                                c,
                                'end',
                                'ended_at'
                              )
                            )
                          )}
                        </td>

                        <td>
                          ${esc(
                            get(
                              c,
                              'duration'
                            ) ??
                            '—'
                          )}
                        </td>
                      </tr>
                    `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `
        : `
          <div style="
            padding:16px;
            color:#777;
          ">
            No completed chains returned.
          </div>
        `
    }
  `;
}

function stateCount(
  members
) {
  return members.filter(
    m => {
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
    }
  ).length;
}

function render(
  data
) {
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

  const name =
    basic.name ||
    'ORANGE';

  const respect =
    get(
      basic,
      'respect',
      'respect_value'
    );

  const rank =
    factionRank(
      basic
    );

  const age =
    formatAge(
      get(
        basic,
        'days_old'
      )
    );

  const leader =
    leaderName(
      basic,
      members
    );

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
      `Capacity ${fmt(
        get(
          basic,
          'capacity'
        )
      )}`;
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
          get(
            basic,
            'capacity'
          )
            ? ` / ${get(
                basic,
                'capacity'
              )}`
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

  renderChain(
    chain
  );

  renderMembers(
    members
  );

  renderCrimes(
    crimes
  );

  renderArmory(
    armory
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
      if ($('#' + id)) {
        $('#' + id).textContent =
          now;
      }
    }
  );
}

function renderMembers(
  members
) {
  const table =
    $('#membersTable');

  if (!table) {
    return;
  }

  table.innerHTML =
    members
      .map(
        m => `
          <tr>
            <td>
              ${esc(
                m.name ||
                m.username ||
                m.id ||
                '—'
              )}
            </td>

            <td>
              ${esc(
                m.level ??
                '—'
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
                get(
                  m,
                  'life.current'
                ) ?? '—'
              )}
            </td>

            <td>
              ${esc(
                get(
                  m,
                  'last_action.relative',
                  'last_action'
                ) || '—'
              )}
            </td>

            <td>
              ${esc(
                get(
                  m,
                  'status.state',
                  'status',
                  'state'
                ) || '—'
              )}
            </td>
          </tr>
        `
      )
      .join('');
}

function renderCrimes(
  crimes
) {
  if ($('#crimesTable')) {
    $('#crimesTable').innerHTML =
      crimes
        .map(
          c => `
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
                ${esc(
                  c.status ||
                  c.state ||
                  '—'
                )}
              </td>

              <td>
                ${esc(
                  formatTime(
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
        .join('');
  }
}

function renderArmory(
  items
) {
  if (!$('#armoryTable')) {
    return;
  }

  $('#armoryTable').innerHTML =
    items
      .map(
        i => `
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
      .join('');
}

async function load() {
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

  } catch (error) {
    console.error(
      'Faction load failed:',
      error
    );
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
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    LIVE_CHAIN =
      data;

    renderChain(
      data.chain || {}
    );

  } catch (error) {
    console.error(
      'Chain load failed:',
      error
    );
  }
}

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
              el =>
                el.classList.remove(
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
        }
      );
    }
  );

if ($('#refreshBtn')) {
  $('#refreshBtn').onclick =
    load;
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
