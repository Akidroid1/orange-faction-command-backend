const TORN_API = 'https://api.torn.com/v2/faction';

const SELECTIONS = [
  'basic',
  'members',
  'chain',
  'chains',
  'crimes',
  'rankedwars',
  'territory',
  'upgrades',
  'positions',
  'applications',
  'reports',
  'attacks',
  'revives',
  'stats',
  'wars',
  'inventory'
];

const LIVE_CHAIN_CACHE_MS = 4000;

const liveChainCache = new Map();
const liveChainInFlight = new Map();
const chainHistoryReady = new Map();

function json(data, status = 200, headers = {}) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
        ...headers
      }
    }
  );
}

function factionId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function errorMessage(data, status) {
  return (
    data?.error?.error ||
    data?.error?.message ||
    data?.message ||
    `Torn returned HTTP ${status}`
  );
}

function normalizeSelectionName(name) {
  const map = {
    rankedwars: 'rankedwar',
    inventory: 'armory'
  };

  return map[name] || name;
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function chainNumber(chain, ...keys) {
  for (const key of keys) {
    const value =
      key.split('.').reduce(
        (obj, part) => obj?.[part],
        chain
      );

    if (
      value !== undefined &&
      value !== null &&
      value !== '' &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }
  }

  return 0;
}

async function tornFetch(id, apiKey) {
  const url = new URL(`${TORN_API}/${id}`);

  url.searchParams.set(
    'selections',
    SELECTIONS.join(',')
  );

  const response = await fetch(
    url,
    {
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

  if (!response.ok || data?.error) {
    throw Object.assign(
      new Error(
        errorMessage(
          data,
          response.status
        )
      ),
      {
        code:
          Number(data?.error?.code || 0),
        status:
          response.status
      }
    );
  }

  return data;
}

async function saveSnapshot(
  env,
  factionIdValue,
  payload
) {
  const fetchedAt =
    new Date().toISOString();

  await env.DB.prepare(
    `
      INSERT INTO faction_snapshots
      (
        faction_id,
        fetched_at,
        payload
      )
      VALUES (?, ?, ?)
    `
  )
    .bind(
      factionIdValue,
      fetchedAt,
      JSON.stringify(payload)
    )
    .run();

  await env.DB.prepare(
    `
      INSERT INTO faction_current
      (
        faction_id,
        fetched_at,
        payload
      )
      VALUES (?, ?, ?)
      ON CONFLICT(faction_id)
      DO UPDATE SET
        fetched_at = excluded.fetched_at,
        payload = excluded.payload
    `
  )
    .bind(
      factionIdValue,
      fetchedAt,
      JSON.stringify(payload)
    )
    .run();

  return fetchedAt;
}

async function getCurrent(
  env,
  id
) {
  const row =
    await env.DB.prepare(
      `
        SELECT
          faction_id,
          fetched_at,
          payload
        FROM faction_current
        WHERE faction_id = ?
        LIMIT 1
      `
    )
      .bind(id)
      .first();

  if (!row) {
    return null;
  }

  let payload;

  try {
    payload =
      JSON.parse(row.payload);
  } catch {
    payload = {};
  }

  return {
    ...payload,
    _meta: {
      ...(payload._meta || {}),
      fetched_at:
        row.fetched_at,
      cached: true,
      source:
        'd1'
    }
  };
}

async function fetchFaction(
  env,
  id
) {
  const data =
    await tornFetch(
      id,
      env.TORN_API_KEY
    );

  const partialFailures = [];
  const normalized = {};

  for (
    const selection of SELECTIONS
  ) {
    const key =
      normalizeSelectionName(
        selection
      );

    if (
      data[key] !== undefined
    ) {
      normalized[key] =
        data[key];
    }
  }

  for (
    const [key, value]
      of Object.entries(data)
  ) {
    if (
      key !== 'error' &&
      normalized[key] === undefined
    ) {
      normalized[key] =
        value;
    }
  }

  normalized._meta = {
    fetched_at:
      new Date().toISOString(),
    cached: false,
    source:
      'torn-api',
    partial_failures:
      partialFailures
  };

  return normalized;
}

async function syncFaction(
  env,
  id
) {
  const startedAt =
    new Date().toISOString();

  let requestCount = 1;
  let success = 0;
  let error = null;

  try {
    const payload =
      await fetchFaction(
        env,
        id
      );

    await saveSnapshot(
      env,
      id,
      payload
    );

    success = 1;

    return payload;

  } catch (x) {
    error =
      x?.message ||
      String(x);

    throw x;

  } finally {
    const finishedAt =
      new Date().toISOString();

    try {
      await env.DB.prepare(
        `
          INSERT INTO sync_log
          (
            started_at,
            finished_at,
            success,
            request_count,
            error
          )
          VALUES (?, ?, ?, ?, ?)
        `
      )
        .bind(
          startedAt,
          finishedAt,
          success,
          requestCount,
          error
        )
        .run();
    } catch {
      // Preserve the original error.
    }
  }
}

/* =========================================================
   CHAIN HISTORY
   ========================================================= */

async function ensureChainHistory(env) {
  const key = 'ready';

  if (chainHistoryReady.has(key)) {
    return chainHistoryReady.get(key);
  }

  const promise =
    (async () => {
      await env.DB.prepare(
        `
          CREATE TABLE IF NOT EXISTS chain_state (
            faction_id INTEGER PRIMARY KEY,
            chain_id TEXT,
            current_chain INTEGER NOT NULL DEFAULT 0,
            peak_chain INTEGER NOT NULL DEFAULT 0,
            started_at TEXT,
            updated_at TEXT NOT NULL
          )
        `
      ).run();

      await env.DB.prepare(
        `
          CREATE TABLE IF NOT EXISTS chain_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            faction_id INTEGER NOT NULL,
            chain_id TEXT,
            chain_count INTEGER NOT NULL DEFAULT 0,
            peak_chain INTEGER NOT NULL DEFAULT 0,
            started_at TEXT,
            ended_at TEXT NOT NULL,
            duration_seconds INTEGER NOT NULL DEFAULT 0,
            modifier TEXT
          )
        `
      ).run();

      await env.DB.prepare(
        `
          CREATE INDEX IF NOT EXISTS
          idx_chain_history_faction_time
          ON chain_history
          (
            faction_id,
            ended_at DESC
          )
        `
      ).run();
    })();

  chainHistoryReady.set(
    key,
    promise
  );

  try {
    await promise;
  } catch (error) {
    chainHistoryReady.delete(key);
    throw error;
  }

  return promise;
}

async function recordChainState(
  env,
  factionIdValue,
  chain
) {
  await ensureChainHistory(env);

  const current =
    chainNumber(
      chain,
      'current',
      'current_chain',
      'chain'
    );

  const chainIdRaw =
    chain?.id ??
    chain?.chain_id ??
    chain?.chain?.id ??
    null;

  const chainId =
    chainIdRaw == null
      ? null
      : String(chainIdRaw);

  const now =
    new Date().toISOString();

  const existing =
    await env.DB.prepare(
      `
        SELECT
          faction_id,
          chain_id,
          current_chain,
          peak_chain,
          started_at,
          updated_at
        FROM chain_state
        WHERE faction_id = ?
        LIMIT 1
      `
    )
      .bind(factionIdValue)
      .first();

  if (!existing) {
    await env.DB.prepare(
      `
        INSERT INTO chain_state
        (
          faction_id,
          chain_id,
          current_chain,
          peak_chain,
          started_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `
    )
      .bind(
        factionIdValue,
        chainId,
        current,
        current,
        current > 0 ? now : null,
        now
      )
      .run();

    return;
  }

  const previousCurrent =
    numberValue(
      existing.current_chain
    );

  const previousPeak =
    numberValue(
      existing.peak_chain
    );

  const previousStarted =
    existing.started_at;

  const chainChanged =
    chainId &&
    existing.chain_id &&
    chainId !==
      String(existing.chain_id);

  const chainFinished =
    previousCurrent > 0 &&
    current === 0;

  /*
   * If Torn gives us a new chain ID while
   * the old chain was still above zero,
   * close the old chain as well.
   */
  if (
    chainFinished ||
    chainChanged
  ) {
    const endedAt =
      now;

    let durationSeconds = 0;

    if (previousStarted) {
      durationSeconds =
        Math.max(
          0,
          Math.floor(
            (
              Date.parse(endedAt) -
              Date.parse(previousStarted)
            ) / 1000
          )
        );
    }

    await env.DB.prepare(
      `
        INSERT INTO chain_history
        (
          faction_id,
          chain_id,
          chain_count,
          peak_chain,
          started_at,
          ended_at,
          duration_seconds,
          modifier
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
      .bind(
        factionIdValue,
        existing.chain_id
          ? String(existing.chain_id)
          : null,
        previousCurrent,
        Math.max(
          previousCurrent,
          previousPeak
        ),
        previousStarted,
        endedAt,
        durationSeconds,
        chain?.modifier != null
          ? String(chain.modifier)
          : null
      )
      .run();
  }

  let nextStarted =
    previousStarted;

  if (
    current > 0 &&
    (
      previousCurrent === 0 ||
      chainChanged ||
      !nextStarted
    )
  ) {
    nextStarted =
      now;
  }

  const nextPeak =
    current > 0
      ? Math.max(
          previousPeak,
          current
        )
      : 0;

  await env.DB.prepare(
    `
      INSERT INTO chain_state
      (
        faction_id,
        chain_id,
        current_chain,
        peak_chain,
        started_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(faction_id)
      DO UPDATE SET
        chain_id =
          excluded.chain_id,
        current_chain =
          excluded.current_chain,
        peak_chain =
          excluded.peak_chain,
        started_at =
          excluded.started_at,
        updated_at =
          excluded.updated_at
    `
  )
    .bind(
      factionIdValue,
      chainId,
      current,
      nextPeak,
      nextStarted,
      now
    )
    .run();
}

async function getChainHistory(
  env,
  id
) {
  await ensureChainHistory(env);

  const result =
    await env.DB.prepare(
      `
        SELECT
          id,
          faction_id,
          chain_id,
          chain_count,
          peak_chain,
          started_at,
          ended_at,
          duration_seconds,
          modifier
        FROM chain_history
        WHERE faction_id = ?
        ORDER BY ended_at DESC
        LIMIT 50
      `
    )
      .bind(id)
      .all();

  return result.results || [];
}

async function tornChainFetch(
  id,
  apiKey,
  env
) {
  const key =
    String(id);

  const now =
    Date.now();

  const cached =
    liveChainCache.get(key);

  if (
    cached &&
    now - cached.savedAt <
      LIVE_CHAIN_CACHE_MS
  ) {
    return cached.data;
  }

  if (
    liveChainInFlight.has(key)
  ) {
    return liveChainInFlight.get(key);
  }

  const promise =
    (async () => {
      const url =
        new URL(
          `${TORN_API}/${id}`
        );

      url.searchParams.set(
        'selections',
        'chain'
      );

      const response =
        await fetch(
          url,
          {
            headers: {
              accept:
                'application/json',
              authorization:
                `ApiKey ${apiKey}`
            }
          }
        );

      let data;

      try {
        data =
          await response.json();
      } catch {
        throw Object.assign(
          new Error(
            `Torn returned HTTP ${response.status}`
          ),
          {
            status:
              response.status
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
            code:
              Number(
                data?.error?.code || 0
              ),
            status:
              response.status
          }
        );
      }

      const chain =
        data?.chain ??
        data ??
        {};

      /*
       * Record the live state before returning it.
       * This is what allows completed chains to
       * survive after Torn resets the live chain.
       */
      await recordChainState(
        env,
        id,
        chain
      );

      const history =
        await getChainHistory(
          env,
          id
        );

      const result = {
        chain,
        history,
        fetched_at:
          new Date().toISOString(),
        request_strategy:
          'live-chain-selection'
      };

      liveChainCache.set(
        key,
        {
          savedAt:
            Date.now(),
          data:
            result
        }
      );

      return result;
    })();

  liveChainInFlight.set(
    key,
    promise
  );

  try {
    return await promise;
  } finally {
    liveChainInFlight.delete(key);
  }
}

async function handleFaction(
  request,
  env
) {
  const url =
    new URL(request.url);

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
    const payload =
      await syncFaction(
        env,
        id
      );

    return json(
      {
        faction_id: id,
        ...payload,
        _meta: {
          ...(payload._meta || {}),
          cached: false,
          source:
            'torn-api'
        }
      },
      200,
      {
        'x-faction-source':
          'torn-api'
      }
    );

  } catch (error) {
    const current =
      await getCurrent(
        env,
        id
      ).catch(
        () => null
      );

    if (current) {
      return json(
        {
          ...current,
          _meta: {
            ...(current._meta || {}),
            cached: true,
            stale: true,
            last_error:
              error?.message ||
              String(error)
          }
        },
        200,
        {
          'x-faction-source':
            'd1-stale'
        }
      );
    }

    return json(
      {
        error:
          error?.message ||
          'Unable to retrieve faction data.',
        error_code:
          Number(error?.code) || null
      },
      Number(error?.code) === 5 ||
      Number(error?.status) === 429
        ? 429
        : 502,
      {
        'retry-after':
          Number(error?.code) === 5 ||
          Number(error?.status) === 429
            ? '10'
            : '0'
      }
    );
  }
}

async function handleLiveChain(
  request,
  env
) {
  const url =
    new URL(request.url);

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
    const data =
      await tornChainFetch(
        id,
        env.TORN_API_KEY,
        env
      );

    return json(
      {
        faction_id:
          Number(id),
        ...data
      },
      200,
      {
        'x-faction-source':
          'torn-live-chain',
        'x-chain-poll-ms':
          String(
            LIVE_CHAIN_CACHE_MS
          )
      }
    );

  } catch (error) {
    return json(
      {
        error:
          error?.message ||
          'Unable to retrieve live chain data.',
        error_code:
          Number(error?.code) || null,
        faction_id:
          Number(id)
      },
      Number(error?.code) === 5 ||
      Number(error?.status) === 429
        ? 429
        : 502,
      {
        'retry-after':
          Number(error?.code) === 5 ||
          Number(error?.status) === 429
            ? '10'
            : '0'
      }
    );
  }
}

async function handleChainHistory(
  request,
  env
) {
  const url =
    new URL(request.url);

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
    const history =
      await getChainHistory(
        env,
        id
      );

    return json(
      {
        faction_id:
          id,
        history
      }
    );
  } catch (error) {
    return json(
      {
        error:
          error?.message ||
          'Unable to retrieve chain history.'
      },
      500
    );
  }
}

async function handleHealth(env) {
  let database =
    'ok';

  try {
    await env.DB.prepare(
      'SELECT 1'
    ).first();
  } catch {
    database =
      'error';
  }

  return json(
    {
      ok:
        database === 'ok',
      database,
      faction_id:
        factionId(
          env.FACTION_ID
        ),
      live_chain:
        true,
      chain_history:
        true
    }
  );
}

async function handleApi(
  request,
  env
) {
  const url =
    new URL(request.url);

  if (
    url.pathname ===
    '/api/faction'
  ) {
    return handleFaction(
      request,
      env
    );
  }

  if (
    url.pathname ===
    '/api/chain'
  ) {
    return handleLiveChain(
      request,
      env
    );
  }

  if (
    url.pathname ===
    '/api/chain-history'
  ) {
    return handleChainHistory(
      request,
      env
    );
  }

  if (
    url.pathname ===
    '/api/health'
  ) {
    return handleHealth(
      env
    );
  }

  return null;
}

export default {
  async fetch(
    request,
    env,
    ctx
  ) {
    const url =
      new URL(
        request.url
      );

    if (
      url.pathname.startsWith(
        '/api/'
      )
    ) {
      const response =
        await handleApi(
          request,
          env
        );

      if (response) {
        return response;
      }
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(
        request
      );
    }

    return new Response(
      'ORANGE Faction Command Center',
      {
        status: 404
      }
    );
  },

  async scheduled(
    event,
    env,
    ctx
  ) {
    const id =
      factionId(
        env.FACTION_ID
      );

    if (!id) {
      return;
    }

    ctx.waitUntil(
      syncFaction(
        env,
        id
      ).catch(
        error => {
          console.error(
            'Scheduled faction sync failed:',
            error
          );
        }
      )
    );
  }
};
