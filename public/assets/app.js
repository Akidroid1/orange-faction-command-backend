const CONFIG = {
  factionId: 53295,
  discordInvite: 'https://discord.gg/duHJkWRRT',
  tornStats: 'https://www.tornstats.com/factions/53295',

  refreshMs: 300000,
  chainRefreshMs: 5000,
  activityClockMs: 60000
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


/* =========================
   DURATION
========================= */

function formatDuration(seconds) {

  let total =
    Number(seconds);

  if (
    !Number.isFinite(total) ||
    total < 0
  ) {
    return '—';
  }

  total =
    Math.floor(total);

  const days =
    Math.floor(
      total / 86400
    );

  total %= 86400;

  const hours =
    Math.floor(
      total / 3600
    );

  total %= 3600;

  const minutes =
    Math.floor(
      total / 60
    );

  const secs =
    total % 60;


  const parts = [];

  if (days) {
    parts.push(
      `${days}d`
    );
  }

  if (hours) {
    parts.push(
      `${hours}h`
    );
  }

  if (minutes) {
    parts.push(
      `${minutes}m`
    );
  }

  if (
    secs ||
    !parts.length
  ) {
    parts.push(
      `${secs}s`
    );
  }

  return parts.join(' ');
}


/* =========================
   GLOBAL DATA
========================= */

let DATA = {};
let LIVE_CHAIN = null;


/* =========================
   LINKS
========================= */

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
    discordBtn: CONFIG.discordInvite,
    heroDiscord: CONFIG.discordInvite,
    statsBtn: CONFIG.tornStats
  };

  Object.entries(
    links
  ).forEach(
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
    Math.floor(
      number / 365
    );

  const months =
    Math.floor(
      (number % 365) / 30
    );

  const remaining =
    number % 30;

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
    remaining ||
    !parts.length
  ) {
    parts.push(
      `${remaining}d`
    );
  }

  return `${parts.join(
    ' '
  )} (${fmt(
    number
  )} days)`;
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


  const commandChain =
    $('#commandChain');

  if (commandChain) {
    commandChain.textContent =
      fmt(
        state.current
      );
  }


  const chainBig =
    $('#chainBig');

  if (chainBig) {
    chainBig.textContent =
      fmt(
        state.current
      );
  }


  const phaseElement =
    $('#chainPhase');

  if (phaseElement) {

    phaseElement.textContent =
      phase;

    phaseElement.className =
      `chain-phase ${
        phase.toLowerCase()
      }`;
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
        fmt(
          state.current
        )
      ],

      [
        'Chain target',
        state.max
          ? fmt(
              state.max
            )
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
        get(
          chain,
          'id'
        ) ?? '—'
      ],

      [
        'Modifier',
        get(
          chain,
          'modifier'
        ) ?? '—'
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

              <span>
                ${esc(
                  row[0]
                )}
              </span>

              <b>
                ${esc(
                  row[1]
                )}
              </b>

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

          return (
            bTime -
            aTime
          );
        }
      );


  container.innerHTML = `

    <div class="panel-head">

      <div>

        <h2>
          Previous Chains
        </h2>

        <span class="muted">
          Completed faction chains
        </span>

      </div>

      <span>
        ${fmt(
          sorted.length
        )}
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
                  .slice(
                    0,
                    100
                  )
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
                              id ??
                              '—'
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
   MEMBER STATUS
========================= */

function getMemberStatus(
  member
) {

  const statusObject =
    get(
      member,
      'status'
    );

  const state =
    String(
      get(
        member,
        'status.state',
        'status.status',
        'state',
        'status'
      ) || ''
    ).toLowerCase();

  const description =
    String(
      get(
        member,
        'status.description',
        'status.desc',
        'description'
      ) || ''
    ).toLowerCase();

  const combined =
    `${state} ${description}`;


  if (
    combined.includes(
      'hospital'
    ) ||
    combined.includes(
      'hospitalized'
    ) ||
    combined.includes(
      'hospitalised'
    )
  ) {
    return {
      label: 'Hospital',
      type: 'hospital'
    };
  }


  if (
    combined.includes(
      'jail'
    ) ||
    combined.includes(
      'jailed'
    ) ||
    combined.includes(
      'prison'
    )
  ) {
    return {
      label: 'Jail',
      type: 'jail'
    };
  }


  if (
    combined.includes(
      'abroad'
    ) ||
    combined.includes(
      'travel'
    ) ||
    combined.includes(
      'travelling'
    ) ||
    combined.includes(
      'traveling'
    )
  ) {
    return {
      label: 'Abroad',
      type: 'abroad'
    };
  }


  if (
    combined.includes(
      'online'
    )
  ) {
    return {
      label: 'Online',
      type: 'online'
    };
  }


  if (
    combined === 'okay' ||
    combined.includes(
      'okay'
    )
  ) {
    return {
      label: 'Okay',
      type: 'okay'
    };
  }


  if (
    combined.includes(
      'active'
    )
  ) {
    return {
      label: 'Active',
      type: 'active'
    };
  }


  if (
    combined.includes(
      'offline'
    ) ||
    combined.includes(
      'inactive'
    )
  ) {
    return {
      label: 'Offline',
      type: 'offline'
    };
  }


  if (
    statusObject &&
    typeof statusObject ===
      'object'
  ) {

    const fallback =
      statusObject.state ||
      statusObject.description;

    if (fallback) {

      return {
        label:
          String(
            fallback
          ),

        type:
          String(
            fallback
          )
            .toLowerCase()
            .replace(
              /[^a-z0-9]+/g,
              '-'
            )
      };
    }
  }


  return {
    label: 'Offline',
    type: 'offline'
  };
}


/* =========================
   MEMBER ACTIVITY
========================= */

function memberActivityTimestamp(
  member
) {

  const last =
    get(
      member,
      'last_action'
    );


  const timestamp =
    get(
      member,
      'last_action.timestamp',
      'last_action.time',
      'last_action.last_action',
      'last_action_at',
      'last_active'
    );


  if (
    timestamp != null
  ) {

    const number =
      Number(
        timestamp
      );

    if (
      Number.isFinite(
        number
      )
    ) {

      if (
        number > 1000000000
      ) {
        return (
          number *
          1000
        );
      }

      return number;
    }
  }


  if (
    typeof last ===
      'string'
  ) {

    const parsed =
      Date.parse(
        last
      );

    if (
      Number.isFinite(
        parsed
      )
    ) {
      return parsed;
    }
  }


  return null;
}


function parseRelativeActivity(
  value
) {

  if (
    value == null
  ) {
    return null;
  }

  const text =
    String(
      value
    )
      .toLowerCase()
      .trim();


  if (!text) {
    return null;
  }


  if (
    text.includes(
      'online'
    ) ||
    text.includes(
      'just now'
    )
  ) {
    return Date.now();
  }


  const match =
    text.match(
      /(\d+(?:\.\d+)?)\s*(second|seconds|sec|secs|minute|minutes|min|mins|hour|hours|hr|hrs|day|days|week|weeks|month|months|year|years)/
    );


  if (!match) {
    return null;
  }


  const amount =
    Number(
      match[1]
    );

  const unit =
    match[2];


  const multipliers = {

    second:
      1000,

    seconds:
      1000,

    sec:
      1000,

    secs:
      1000,

    minute:
      60000,

    minutes:
      60000,

    min:
      60000,

    mins:
      60000,

    hour:
      3600000,

    hours:
      3600000,

    hr:
      3600000,

    hrs:
      3600000,

    day:
      86400000,

    days:
      86400000,

    week:
      604800000,

    weeks:
      604800000,

    month:
      2592000000,

    months:
      2592000000,

    year:
      31536000000,

    years:
      31536000000

  };


  const multiplier =
    multipliers[unit];


  if (
    !multiplier
  ) {
    return null;
  }


  return (
    Date.now() -
    (
      amount *
      multiplier
    )
  );
}


function getMemberActivity(
  member
) {

  const timestamp =
    memberActivityTimestamp(
      member
    );


  if (
    timestamp != null
  ) {
    return timestamp;
  }


  return parseRelativeActivity(
    get(
      member,
      'last_action.relative',
      'last_action.description',
      'activity',
      'last_activity'
    )
  );
}


function formatRelativeActivity(
  timestamp
) {

  if (
    timestamp == null
  ) {
    return 'No activity data';
  }


  const elapsed =
    Math.max(
      0,
      Date.now() -
      Number(timestamp)
    );


  const seconds =
    Math.floor(
      elapsed / 1000
    );


  if (
    seconds < 60
  ) {
    return 'Active now';
  }


  const minutes =
    Math.floor(
      seconds / 60
    );


  if (
    minutes < 60
  ) {
    return `${minutes}m ago`;
  }


  const hours =
    Math.floor(
      minutes / 60
    );


  if (
    hours < 24
  ) {

    const remaining =
      minutes % 60;

    return remaining
      ? `${hours}h ${remaining}m ago`
      : `${hours}h ago`;
  }


  const days =
    Math.floor(
      hours / 24
    );


  if (
    days < 30
  ) {
    return `${days}d ago`;
  }


  const months =
    Math.floor(
      days / 30
    );


  if (
    months < 12
  ) {
    return `${months}mo ago`;
  }


  const years =
    Math.floor(
      months / 12
    );


  return `${years}y ago`;
}


/* =========================
   MEMBER SORTING
========================= */

function memberSortScore(
  member
) {

  const status =
    getMemberStatus(
      member
    );


  const priority = {

    online: 0,
    active: 1,
    okay: 2,
    hospital: 3,
    abroad: 4,
    jail: 5,
    offline: 6

  };


  return (
    priority[
      status.type
    ] ??
    7
  );
}


function sortMembers(
  members
) {

  return [
    ...members
  ].sort(
    (a, b) => {

      const statusA =
        memberSortScore(
          a
        );

      const statusB =
        memberSortScore(
          b
        );


      if (
        statusA !==
        statusB
      ) {
        return (
          statusA -
          statusB
        );
      }


      const activityA =
        getMemberActivity(
          a
        ) || 0;


      const activityB =
        getMemberActivity(
          b
        ) || 0;


      return (
        activityB -
        activityA
      );
    }
  );
}


/* =========================
   MEMBER COUNTERS
========================= */

function getMemberCounts(
  members
) {

  const counts = {

    total:
      members.length,

    online: 0,

    active: 0,

    okay: 0,

    offline: 0,

    hospital: 0,

    abroad: 0,

    jail: 0

  };


  members.forEach(
    member => {

      const status =
        getMemberStatus(
          member
        );


      if (
        counts[
          status.type
        ] !== undefined
      ) {

        counts[
          status.type
        ]++;

      }

    }
  );


  return counts;
}


/* =========================
   MEMBERS TABLE
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
      $('#memberSearch')
        ?.value ||
      ''
    )
      .trim()
      .toLowerCase();


  const filtered =
    members.filter(
      member => {

        if (!query) {
          return true;
        }

        return JSON.stringify(
          member
        )
          .toLowerCase()
          .includes(
            query
          );
      }
    );


  const sorted =
    sortMembers(
      filtered
    );


  const counts =
    getMemberCounts(
      members
    );


  const memberOnline =
    $('#memberOnline');

  if (memberOnline) {
    memberOnline.textContent =
      fmt(
        counts.online
      );
  }


  const memberOffline =
    $('#memberOffline');

  if (memberOffline) {
    memberOffline.textContent =
      fmt(
        counts.offline
      );
  }


  const memberHospital =
    $('#memberHospital');

  if (memberHospital) {
    memberHospital.textContent =
      fmt(
        counts.hospital
      );
  }


  const memberAbroad =
    $('#memberAbroad');

  if (memberAbroad) {
    memberAbroad.textContent =
      fmt(
        counts.abroad
      );
  }


  const memberJail =
    $('#memberJail');

  if (memberJail) {
    memberJail.textContent =
      fmt(
        counts.jail
      );
  }


  table.innerHTML =
    sorted
      .map(
        member => {

          const status =
            getMemberStatus(
              member
            );


          const activity =
            getMemberActivity(
              member
            );


          const id =
            member.id ??
            member.user_id ??
            member.player_id;


          const name =
            member.name ||
            member.username ||
            id ||
            'Unknown';


          const level =
            member.level ??
            '—';


          const position =
            get(
              member,
              'position.name',
              'position',
              'role'
            ) ||
            '—';


          const statusClass =
            status.type
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
                    id ?? ''
                  )}"
                  target="_blank"
                  rel="noopener"
                >
                  ${esc(name)}
                </a>

              </td>


              <td>
                ${esc(level)}
              </td>


              <td>
                ${esc(position)}
              </td>


              <td>

                <span
                  class="pill status-${esc(
                    statusClass
                  )}"
                >
                  ${esc(
                    status.label
                  )}
                </span>

              </td>


              <td
                class="member-activity"
                data-activity-ts="${
                  activity ??
                  ''
                }"
              >
                ${esc(
                  formatRelativeActivity(
                    activity
                  )
                )}
              </td>

            </tr>

          `;
        }
      )
      .join('') ||

    `
      <tr>

        <td colspan="5">
          No member data returned.
        </td>

      </tr>
    `;
}


/* =========================
   LOCAL ACTIVITY CLOCK
========================= */

function updateMemberActivityClock() {

  document
    .querySelectorAll(
      '.member-activity[data-activity-ts]'
    )
    .forEach(
      element => {

        const timestamp =
          Number(
            element.dataset
              .activityTs
          );


        if (
          !Number.isFinite(
            timestamp
          )
        ) {
          return;
        }


        element.textContent =
          formatRelativeActivity(
            timestamp
          );
      }
    );
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


  const counts =
    getMemberCounts(
      members
    );


  const activeMembers =
    counts.online +
    counts.active;


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

    $('#readinessTitle')
      .textContent =
        readiness >= 75
          ? 'Combat ready'
          : readiness >= 45
            ? 'Operational'
            : 'Standby';
  }


  if ($('#readinessText')) {

    $('#readinessText')
      .textContent =
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
      $('#armorySearch')
        ?.value ||
      ''
    )
      .toLowerCase();


  table.innerHTML =
    items
      .filter(
        item =>
          JSON.stringify(
            item
          )
            .toLowerCase()
            .includes(
              query
            )
      )
      .slice(
        0,
        300
      )
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
                item.id ??
                '—'
              )}
            </td>

          </tr>`
      )
      .join('') ||

    '<tr><td colspan="4">Armory inventory is unavailable.</td></tr>';
}


/* =========================
   WAR
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
          typeof value !==
          'object'
      )
      .slice(
        0,
        24
      );


  if ($('#warBadge')) {

    $('#warBadge')
      .textContent =
        entries.length
          ? 'DATA'
          : 'NO ACTIVE DATA';
  }


  container.innerHTML =
    entries
      .map(
        ([key, value]) =>
          `<div class="list-row">

            <span>
              ${esc(
                key.replaceAll(
                  '_',
                  ' '
                )
              )}
            </span>

            <b>
              ${esc(value)}
            </b>

          </div>`
      )
      .join('') ||

    '<div class="empty">No ranked-war data returned.</div>';
}


/* =========================
   TERRITORY
========================= */

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
          typeof value !==
          'object'
      )
      .slice(
        0,
        24
      );


  container.innerHTML =
    entries
      .map(
        ([key, value]) =>
          `<div class="list-row">

            <span>
              ${esc(
                key.replaceAll(
                  '_',
                  ' '
                )
              )}
            </span>

            <b>
              ${esc(value)}
            </b>

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

            <b>
              ${esc(
                upgrade.name ||
                upgrade.upgrade ||
                upgrade.id
              )}
            </b>

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
    rows.slice(
      0,
      12
    );


  const columns =
    [
      ...new Set(
        sample.flatMap(
          object =>
            typeof object ===
              'object'
              ? Object.keys(
                  object
                )
              : ['value']
        )
      )
    ]
      .filter(
        key =>
          key !== 'id'
      )
      .slice(
        0,
        4
      );


  element.innerHTML =
    `<table>

      <thead>

        <tr>

          ${columns
            .map(
              column =>
                `<th>
                  ${esc(
                    column.replaceAll(
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

        ${sample
          .map(
            object =>
              `<tr>

                ${columns
                  .map(
                    column =>
                      `<td>
                        ${esc(
                          typeof object ===
                            'object'
                            ? typeof object[
                                column
                              ] ===
                              'object'
                              ? JSON.stringify(
                                  object[
                                    column
                                  ]
                                )
                              : object[
                                  column
                                ]
                            : object
                        )}
                      </td>`
                  )
                  .join('')}

              </tr>`
          )
          .join('')}

      </tbody>

    </table>`;
}


/* =========================
   MAIN RENDER
========================= */

function render(
  data
) {

  DATA = data;


  const basic =
    data.basic ||
    {};


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
    data.chain ||
    {};


  const rankedWar =
    data.rankedwar ||
    data.rankedwars ||
    null;


  const name =
    basic.name ||
    'ORANGE';


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
      `Capacity ${fmt(
        capacity
      )}`;
  }


  if ($('#rank')) {
    $('#rank').textContent =
      rank;
  }


  if ($('#ocCount')) {
    $('#ocCount').textContent =
      fmt(
        crimes.length
      );
  }


  const memberCounts =
    getMemberCounts(
      members
    );


  if ($('#onlineCount')) {
    $('#onlineCount').textContent =
      fmt(
        memberCounts.online
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

              <span>
                ${esc(
                  row[0]
                )}
              </span>

              <b>
                ${esc(
                  row[1]
                )}
              </b>

            </div>`
        )
        .join('');
  }


  renderChain(
    chain
  );


  const completedChains =
    data.chains ||
    data.history ||
    [];


  renderCompletedChains(
    completedChains
  );


  renderReadiness(
    members,
    crimes,
    chain,
    rankedWar
  );


  if ($('#liveInfo')) {

    $('#liveInfo').innerHTML = [

      [
        'Roster',
        `${members.length} members / ${memberCounts.online} online`
      ],

      [
        'Offline',
        memberCounts.offline
      ],

      [
        'Hospital',
        memberCounts.hospital
      ],

      [
        'Abroad',
        memberCounts.abroad
      ],

      [
        'Jail',
        memberCounts.jail
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

            <span>
              ${esc(
                row[0]
              )}
            </span>

            <b>
              ${esc(
                row[1]
              )}
            </b>

          </div>`
      )
      .join('');
  }


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
      `${
        keys.filter(
          key =>
            data[key]
        ).length
      }/${keys.length}`;
  }


  if ($('#coverageInfo')) {

    $('#coverageInfo').innerHTML =
      keys
        .map(
          key =>
            `<div class="coverage-row">

              <span>
                ${esc(key)}
              </span>

              <i
                class="${
                  data[key]
                    ? 'ok'
                    : 'no'
                }"
              >
                ${
                  data[key]
                    ? '●'
                    : '○'
                }
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


  const memberSync =
    get(
      data,
      '_meta.members_synced_at',
      '_meta.fetched_at'
    );


  if ($('#memberSyncTime')) {

    $('#memberSyncTime')
      .textContent =
        memberSync
          ? `Member data synced ${formatTime(
              memberSync
            )}`
          : 'Member data synced —';
  }
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
          cache:
            'no-store'
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


    render(
      data
    );


    if ($('#statusLine')) {

      $('#statusLine')
        .textContent =
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

  } catch (
    exception
  ) {

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
          cache:
            'no-store'
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


    renderChain(
      data.chain || {}
    );


    const previousChains =
      data.chains ||
      data.history ||
      [];


    renderCompletedChains(
      previousChains
    );


    if (
      DATA &&
      Object.keys(
        DATA
      ).length
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

  } catch (
    error
  ) {

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
  .querySelectorAll(
    '.nav'
  )
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


/* =========================
   BUTTONS / SEARCH
========================= */

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


/* =========================
   START
========================= */

load();

loadLiveChain();


/*
 * Full faction/member sync:
 * every 5 minutes.
 */

setInterval(
  load,
  CONFIG.refreshMs
);


/*
 * Live chain:
 * every 5 seconds.
 */

setInterval(
  loadLiveChain,
  CONFIG.chainRefreshMs
);


/*
 * Member activity clock:
 * every minute.
 */

setInterval(
  updateMemberActivityClock,
  CONFIG.activityClockMs
);
