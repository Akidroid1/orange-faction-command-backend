const TORN_API = 'https://api.torn.com/v2/faction/';
const DEFAULT_FACTION_ID = '53295';

/*
 * Start with only confirmed-working faction selections.
 *
 * "chains" is the current faction API selection.
 * We intentionally leave the other feeds out for now
 * so one bad selection cannot break the entire dashboard.
 */
const SELECTIONS = [
  'basic',
  'members',
  'chains'
];

const json = (data, status = 200, headers = {}) => {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
        ...headers
      }
    }
  );
};

function factionId(value) {
  const id = String(
    value || DEFAULT_FACTION_ID
  ).trim();

  return /^\d+$/.test(id)
    ? id
    : null;
}

function errorMessage(data, status) {
  return (
    data?.error?.error ||
    data?.error ||
    `Torn HTTP ${status}`
  );
}

async function tornFetch(id, apiKey) {
  const url = new URL(TORN_API);

  url.searchParams.set(
    'id',
    id
  );

  url.searchParams.set(
    'selections',
    SELECTIONS.join(',')
  );

  const response = await fetch(
    url.toString(),
    {
      method: 'GET',

      headers: {
        accept: 'application/json',
        authorization: `ApiKey ${apiKey}`
      }
    }
  );

  let data;

  try {
    data = await response.json();
  } catch {
    throw Object.assign(
      new Error(
        `Torn returned HTTP ${response.status}`
      ),
      {
        status: response.status
      }
    );
  }

  if (
    !response.ok ||
    data?.error
  ) {
    throw Object.assign(
      new Error(
        errorMessage(
          data,
          response.status
        )
      ),
      {
        code: Number(
          data?.error?.code || 0
        ),
        status:
          response.status
      }
    );
  }

  return data || {};
}

function normalize(
  data,
  id
) {
  const result = {
    ...data
  };

  /*
   * The dashboard historically expects
   * "chain", so convert Torn's current
   * "chains" response into that name too.
   */

  if (
    !result.chain &&
    result.chains
  ) {
    result.chain =
      result.chains;
  }

  return {
    ...result,

    _meta: {
      faction_id:
        Number(id),

      fetched_at:
        new Date().toISOString(),

      request_count: 1,

      request_strategy:
        'single-torn-v2-request',

      selections:
        SELECTIONS,

      cached: true,

      partial_failures: []
    }
  };
}

function memberArray(
  data
) {
  const value =
    data?.members?.members ??
    data?.members;

  if (
    Array.isArray(value)
  ) {
    return value;
  }

  if (
    value &&
    typeof value === 'object'
  ) {
    return Object.values(
      value
    );
  }

  return [];
}

function memberText(
  member,
  ...paths
) {
  for (
    const path of paths
  ) {
    const value =
      path
        .split('.')
        .reduce(
          (a, k) =>
            a?.[k],
          member
        );

    if (
      value !== undefined &&
      value !== null
    ) {
      return String(value);
    }
  }

  return null;
}

async function saveSnapshot(
  env,
  id,
  data,
  fetchedAt
) {
  await env.DB.prepare(`
    INSERT INTO faction_snapshots
    (
      faction_id,
      fetched_at,
      payload
    )
    VALUES (?, ?, ?)
  `)
    .bind(
      Number(id),
      fetchedAt,
      JSON.stringify(data)
    )
    .run();

  await env.DB.prepare(`
    INSERT INTO faction_current
    (
      faction_id,
      fetched_at,
      payload
    )
    VALUES (?, ?, ?)

    ON CONFLICT(faction_id)
    DO UPDATE SET
      fetched_at =
        excluded.fetched_at,
      payload =
        excluded.payload
  `)
    .bind(
      Number(id),
      fetchedAt,
      JSON.stringify(data)
    )
    .run();

  const members =
    memberArray(data);

  if (
    members.length
  ) {
    const statements =
      members.map(
        member =>
          env.DB.prepare(`
            INSERT INTO member_snapshots
            (
              faction_id,
              member_id,
              name,
              level,
              position,
              status,
              last_action,
              fetched_at,
              payload
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
            .bind(
              Number(id),

              Number(
                member.id || 0
              ),

              member.name ||
                member.username ||
                null,

              member.level == null
                ? null
                : Number(
                    member.level
                  ),

              memberText(
                member,
                'position.name',
                'position',
                'role'
              ),

              memberText(
                member,
                'status.state',
                'status',
                'state'
              ),

              memberText(
                member,
                'last_action.relative',
                'last_action.timestamp',
                'last_action'
              ),

              fetchedAt,

              JSON.stringify(
                member
              )
            )
      );

    for (
      let i = 0;
      i < statements.length;
      i += 50
    ) {
      await env.DB.batch(
        statements.slice(
          i,
          i + 50
        )
      );
    }
  }

  /*
   * Keep approximately
   * 2 weeks of snapshots.
   */
  await env.DB.prepare(`
    DELETE FROM faction_snapshots

    WHERE id NOT IN (
      SELECT id
      FROM faction_snapshots
      WHERE faction_id = ?
      ORDER BY fetched_at DESC
      LIMIT 2016
    )

    AND faction_id = ?
  `)
    .bind(
      Number(id),
      Number(id)
    )
    .run();
}

async function syncFaction(
  env,
  id
) {
  const started =
    new Date().toISOString();

  try {
    const raw =
      await tornFetch(
        id,
        env.TORN_API_KEY
      );

    const data =
      normalize(
        raw,
        id
      );

    const finished =
      new Date().toISOString();

    await saveSnapshot(
      env,
      id,
      data,
      finished
    );

    await env.DB.prepare(`
      INSERT INTO sync_log
      (
        started_at,
        finished_at,
        success,
        request_count,
        error
      )
      VALUES (?, ?, 1, 1, NULL)
    `)
      .bind(
        started,
        finished
      )
      .run();

    return data;

  } catch (error) {

    const finished =
      new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO sync_log
      (
        started_at,
        finished_at,
        success,
        request_count,
        error
      )
      VALUES (?, ?, 0, 1, ?)
    `)
      .bind(
        started,
        finished,
        error?.message ||
          String(error)
      )
      .run();

    throw error;
  }
}

async function currentFaction(
  env,
  id
) {
  const row =
    await env.DB.prepare(`
      SELECT
        fetched_at,
        payload
      FROM faction_current
      WHERE faction_id = ?
    `)
      .bind(
        Number(id)
      )
      .first();

  if (!row) {
    return null;
  }

  try {
    const data =
      JSON.parse(
        row.payload
      );

    data._meta = {
      ...(data._meta || {}),

      fetched_at:
        row.fetched_at,

      cached: true
    };

    return data;

  } catch {
    return null;
  }
}

async function handleFaction(
  request,
  env
) {
  const url =
    new URL(
      request.url
    );

  const id =
    factionId(
      url.searchParams.get(
        'faction_id'
      ) ||
      env.FACTION_ID
    );

  if (!id) {
    return json(
      {
        error:
          'Invalid faction_id.'
      },
      400
    );
  }

  /*
   * Use the stored database
   * snapshot first.
   */
  const cached =
    await currentFaction(
      env,
      id
    );

  if (cached) {
    return json(
      cached,
      200,
      {
        'x-faction-source':
          'database'
      }
    );
  }

  if (!env.TORN_API_KEY) {
    return json(
      {
        error:
          'TORN_API_KEY is not configured.'
      },
      500
    );
  }

  try {
    const fresh =
      await syncFaction(
        env,
        id
      );

    return json(
      fresh,
      200,
      {
        'x-faction-source':
          'torn-initial-sync'
      }
    );

  } catch (error) {

    const status =
      Number(error?.code) === 5 ||
      Number(error?.status) === 429
        ? 429
        : 502;

    return json(
      {
        error:
          error?.message ||
          'Unable to synchronize faction data.',

        error_code:
          Number(
            error?.code
          ) || null,

        faction_id:
          Number(id),

        request_count: 1
      },

      status,

      {
        'retry-after':
          status === 429
            ? '60'
            : '0'
      }
    );
  }
}

async function handleHistory(
  request,
  env
) {
  const url =
    new URL(
      request.url
    );

  const id =
    factionId(
      url.searchParams.get(
        'faction_id'
      ) ||
      env.FACTION_ID
    );

  if (!id) {
    return json(
      {
        error:
          'Invalid faction_id.'
      },
      400
    );
  }

  const limit =
    Math.min(
      500,
      Math.max(
        1,
        Number(
          url.searchParams.get(
            'limit'
          ) || 100
        )
      )
    );

  const rows =
    await env.DB.prepare(`
      SELECT
        id,
        fetched_at,
        payload
      FROM faction_snapshots
      WHERE faction_id = ?
      ORDER BY fetched_at DESC
      LIMIT ?
    `)
      .bind(
        Number(id),
        limit
      )
      .all();

  return json({
    faction_id:
      Number(id),

    snapshots:
      rows.results || []
  });
}

async function handleSync(
  request,
  env
) {
  if (
    request.method !==
    'POST'
  ) {
    return json(
      {
        error:
          'POST required.'
      },
      405
    );
  }

  const secret =
    request.headers.get(
      'x-admin-secret'
    );

  if (
    !env.SYNC_SECRET ||
    secret !==
      env.SYNC_SECRET
  ) {
    return json(
      {
        error:
          'Unauthorized.'
      },
      401
    );
  }

  const url =
    new URL(
      request.url
    );

  const id =
    factionId(
      url.searchParams.get(
        'faction_id'
      ) ||
      env.FACTION_ID
    );

  if (!id) {
    return json(
      {
        error:
          'Invalid faction_id.'
      },
      400
    );
  }

  try {
    const data =
      await syncFaction(
        env,
        id
      );

    return json({
      ok: true,

      faction_id:
        Number(id),

      fetched_at:
        data._meta
          .fetched_at
    });

  } catch (error) {

    const status =
      Number(error?.code) === 5 ||
      Number(error?.status) === 429
        ? 429
        : 502;

    return json(
      {
        error:
          error?.message ||
          'Sync failed.',

        error_code:
          Number(
            error?.code
          ) || null
      },
      status
    );
  }
}

async function handleHealth(
  env
) {
  const row =
    await env.DB.prepare(`
      SELECT
        fetched_at
      FROM faction_current
      WHERE faction_id = ?
    `)
      .bind(
        Number(
          env.FACTION_ID ||
          DEFAULT_FACTION_ID
        )
      )
      .first();

  const log =
    await env.DB.prepare(`
      SELECT
        finished_at,
        success,
        error
      FROM sync_log
      ORDER BY id DESC
      LIMIT 1
    `)
      .first();

  return json({
    ok: true,

    service:
      'orange-faction-backend',

    database: true,

    last_sync:
      row?.fetched_at ||
      null,

    last_sync_result:
      log
        ? {
            finished_at:
              log.finished_at,

            success:
              Boolean(
                log.success
              ),

            error:
              log.error
          }
        : null,

    time:
      new Date().toISOString()
  });
}

export default {

  async fetch(
    request,
    env
  ) {
    const url =
      new URL(
        request.url
      );

    try {

      if (
        url.pathname ===
        '/api/faction'
      ) {
        return await handleFaction(
          request,
          env
        );
      }

      if (
        url.pathname ===
        '/api/history'
      ) {
        return await handleHistory(
          request,
          env
        );
      }

      if (
        url.pathname ===
        '/api/sync'
      ) {
        return await handleSync(
          request,
          env
        );
      }

      if (
        url.pathname ===
        '/api/health'
      ) {
        return await handleHealth(
          env
        );
      }

      return env.ASSETS.fetch(
        request
      );

    } catch (error) {

      return json(
        {
          error:
            error?.message ||
            'Backend error.'
        },
        500
      );
    }
  },

  async scheduled(
    controller,
    env,
    ctx
  ) {
    const id =
      factionId(
        env.FACTION_ID
      ) ||
      DEFAULT_FACTION_ID;

    if (
      !env.TORN_API_KEY ||
      !env.DB
    ) {
      return;
    }

    ctx.waitUntil(
      syncFaction(
        env,
        id
      ).catch(
        () => {}
      )
    );
  }
};
