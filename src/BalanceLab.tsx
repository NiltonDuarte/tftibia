import { Fragment, useMemo, useState } from "react";
import { vocations } from "./content/content";
import {
  BALANCE_STRATEGIES,
  runBalanceBatchAsync,
  runCampaign,
} from "./game/balance";
import { createGame, type GameAction, type SeedRunResult } from "./game/engine";
import type { GameReplay } from "./game/replay";
import styles from "./BalanceLab.module.css";

type SortKey = keyof SeedRunResult;
type SortDirection = "asc" | "desc";
type SummaryRow = {
  vocationId: string;
  strategyId: string;
  seeds: number;
  wins: number;
  losses: number;
  winRate: number;
  averageCleared: number;
};
type SummarySortKey = keyof Pick<
  SummaryRow,
  | "vocationId"
  | "strategyId"
  | "seeds"
  | "wins"
  | "losses"
  | "winRate"
  | "averageCleared"
>;

function csvValue(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportCsv(results: SeedRunResult[]): void {
  const columns: SortKey[] = [
    "seed",
    "vocationId",
    "strategyId",
    "outcome",
    "encountersPlayed",
    "encountersCleared",
    "finalLives",
    "finalGold",
    "finalRosterSize",
    "purchasesMade",
    "rerollsUsed",
  ];
  const csv = [
    columns.join(","),
    ...results.map((result) =>
      columns.map((column) => csvValue(result[column])).join(","),
    ),
  ].join("\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "tibia-tactics-balance-results.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function createSimulationReplay(result: SeedRunResult): GameReplay | null {
  const strategy = BALANCE_STRATEGIES.find(
    (candidate) => candidate.id === result.strategyId,
  );
  if (!strategy) return null;
  const actions: GameAction[] = [];
  runCampaign(result.seed, result.vocationId, strategy, { actions });
  return {
    version: 1,
    source: "simulation",
    seed: result.seed,
    baseState: createGame(result.seed),
    actions,
    vocationId: result.vocationId,
    strategyId: result.strategyId,
  };
}

function downloadReplay(replay: GameReplay): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(replay, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `tibia-replay-${replay.vocationId ?? "player"}-${replay.strategyId ?? "run"}-${replay.seed}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function displayValue(value: string | number): string {
  const labels: Record<string, string> = {
    "random-baseline": "Random baseline",
    "synergy-builder": "Synergy builder",
    "family-stack": "Family stack",
    "frontline-wall": "Frontline wall",
    "ranged-burst": "Ranged burst",
    "vocation-specialist": "Vocation specialist",
    knight: "Knight",
    paladin: "Paladin",
    sorcerer: "Sorcerer",
    druid: "Druid",
    win: "Win",
    lose: "Loss",
  };
  return labels[String(value)] ?? String(value);
}

function SortButton({
  column,
  label,
  active,
  direction,
  onSort,
}: {
  column: SortKey;
  label: string;
  active: boolean;
  direction: SortDirection;
  onSort: (column: SortKey) => void;
}) {
  return (
    <button
      className={styles.sortButton}
      type="button"
      onClick={() => onSort(column)}
    >
      {label}
      {active ? (direction === "asc" ? " ↑" : " ↓") : " ↕"}
    </button>
  );
}

export function BalanceLab({
  onBack,
  onPlayReplay,
}: {
  onBack: () => void;
  onPlayReplay: (replay: GameReplay) => void;
}) {
  const [seedCount, setSeedCount] = useState("100");
  const [firstSeed, setFirstSeed] = useState("1");
  const [selectedVocations, setSelectedVocations] = useState<string[]>(
    vocations.map((vocation) => vocation.id),
  );
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(
    BALANCE_STRATEGIES.map((strategy) => strategy.id),
  );
  const [results, setResults] = useState<SeedRunResult[]>([]);
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "seed",
    direction: "asc",
  });
  const [summarySort, setSummarySort] = useState<{
    key: SummarySortKey;
    direction: SortDirection;
  }>({ key: "winRate", direction: "desc" });
  const [vocationFilter, setVocationFilter] = useState("all");
  const [strategyFilter, setStrategyFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [traceKey, setTraceKey] = useState<string | null>(null);
  const [traceEntries, setTraceEntries] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const running = progress !== null;

  const filteredResults = useMemo(
    () =>
      results.filter(
        (result) =>
          (vocationFilter === "all" || result.vocationId === vocationFilter) &&
          (strategyFilter === "all" || result.strategyId === strategyFilter) &&
          (outcomeFilter === "all" || result.outcome === outcomeFilter),
      ),
    [results, vocationFilter, strategyFilter, outcomeFilter],
  );
  const sortedResults = useMemo(
    () =>
      [...filteredResults].sort((a, b) => {
        const left = a[sort.key];
        const right = b[sort.key];
        const comparison =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right));
        return comparison * (sort.direction === "asc" ? 1 : -1);
      }),
    [filteredResults, sort],
  );
  const visibleResults = sortedResults.slice(
    page * pageSize,
    (page + 1) * pageSize,
  );
  const wins = filteredResults.filter(
    (result) => result.outcome === "win",
  ).length;
  const winRate = filteredResults.length
    ? (wins / filteredResults.length) * 100
    : 0;
  const pageCount = Math.ceil(sortedResults.length / pageSize);
  const summaryRows = useMemo(() => {
    const groups = new Map<
      string,
      {
        vocationId: string;
        strategyId: string;
        seeds: number;
        wins: number;
        cleared: number;
      }
    >();
    for (const result of results) {
      if (vocationFilter !== "all" && result.vocationId !== vocationFilter)
        continue;
      if (strategyFilter !== "all" && result.strategyId !== strategyFilter)
        continue;
      const key = `${result.vocationId}:${result.strategyId}`;
      const group = groups.get(key) ?? {
        vocationId: result.vocationId,
        strategyId: result.strategyId,
        seeds: 0,
        wins: 0,
        cleared: 0,
      };
      group.seeds += 1;
      if (result.outcome === "win") group.wins += 1;
      group.cleared += result.encountersCleared;
      groups.set(key, group);
    }
    return [...groups.values()]
      .map((group) => ({
        ...group,
        losses: group.seeds - group.wins,
        winRate: (group.wins / group.seeds) * 100,
        averageCleared: group.cleared / group.seeds,
      }))
      .sort((a, b) => {
        const left = a[summarySort.key];
        const right = b[summarySort.key];
        const comparison =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right));
        return comparison * (summarySort.direction === "asc" ? 1 : -1);
      });
  }, [results, vocationFilter, strategyFilter, summarySort]);

  const run = async () => {
    if (
      running ||
      selectedVocations.length === 0 ||
      selectedStrategies.length === 0
    )
      return;
    const count = Math.max(
      1,
      Math.min(10000, Math.trunc(Number(seedCount) || 1)),
    );
    const seed = Math.trunc(Number(firstSeed) || 0) >>> 0;
    setResults([]);
    setRunError(null);
    setPage(0);
    setProgress({
      completed: 0,
      total: count * selectedVocations.length * selectedStrategies.length,
    });
    try {
      const nextResults = await runBalanceBatchAsync(
        {
          firstSeed: seed,
          seedCount: count,
          vocationIds: selectedVocations,
          strategies: BALANCE_STRATEGIES.filter((strategy) =>
            selectedStrategies.includes(strategy.id),
          ),
        },
        (completed, total) => {
          if (completed % 100 === 0 || completed === total)
            setProgress({ completed, total });
        },
      );
      setResults(nextResults);
    } catch (error) {
      setRunError(
        error instanceof Error ? error.message : "The campaign run failed.",
      );
    } finally {
      setProgress(null);
    }
  };

  const toggle = (
    values: string[],
    setValues: (items: string[]) => void,
    value: string,
  ) => {
    setValues(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  };
  const sortBy = (key: SortKey) => {
    setPage(0);
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };
  const sortSummaryBy = (key: SummarySortKey) =>
    setSummarySort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));

  return (
    <section className={styles.lab}>
      <div className={styles.heading}>
        <div>
          <div className={styles.eyebrow}>Game core · Balance simulator</div>
          <h1>Campaign balance lab</h1>
          <p>
            Run complete seeded campaigns with fixed strategies and compare win
            rates across vocations.
          </p>
        </div>
        <button className={styles.backButton} type="button" onClick={onBack}>
          ← Return to campaign
        </button>
      </div>
      <section
        className={styles.controls}
        aria-label="Simulation configuration"
      >
        <div className={styles.numberFields}>
          <label>
            Number of seeds
            <input
              type="number"
              min="1"
              max="10000"
              value={seedCount}
              onChange={(event) => setSeedCount(event.target.value)}
            />
          </label>
          <label>
            First seed
            <input
              type="number"
              min="0"
              max="4294967295"
              value={firstSeed}
              onChange={(event) => setFirstSeed(event.target.value)}
            />
          </label>
        </div>
        <fieldset>
          <legend>Vocations</legend>
          <div className={styles.checkGrid}>
            {vocations.map((vocation) => (
              <label key={vocation.id}>
                <input
                  type="checkbox"
                  checked={selectedVocations.includes(vocation.id)}
                  onChange={() =>
                    toggle(selectedVocations, setSelectedVocations, vocation.id)
                  }
                />
                {vocation.name}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Strategies</legend>
          <div className={styles.strategyGrid}>
            {BALANCE_STRATEGIES.map((strategy) => (
              <label key={strategy.id} title={strategy.description}>
                <input
                  type="checkbox"
                  checked={selectedStrategies.includes(strategy.id)}
                  onChange={() =>
                    toggle(
                      selectedStrategies,
                      setSelectedStrategies,
                      strategy.id,
                    )
                  }
                />
                <span>
                  <b>{strategy.name}</b>
                  <small>{strategy.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className={styles.runRow}>
          <button
            className={styles.runButton}
            type="button"
            disabled={
              running || !selectedVocations.length || !selectedStrategies.length
            }
            onClick={() => void run()}
          >
            {running ? "Running campaigns…" : "Run balance suite"}
          </button>
          <span>
            {(
              selectedVocations.length *
              selectedStrategies.length *
              Math.max(1, Number(seedCount) || 1)
            ).toLocaleString()}{" "}
            campaigns per run
          </span>
        </div>
        {progress && (
          <div className={styles.progressBlock}>
            <div>
              Simulating {progress.completed.toLocaleString()} /{" "}
              {progress.total.toLocaleString()}
            </div>
            <progress max={progress.total} value={progress.completed} />
          </div>
        )}
        {runError && (
          <p role="alert" className={styles.error}>
            {runError}
          </p>
        )}
      </section>
      {results.length > 0 && (
        <>
          <section
            className={styles.summary}
            aria-label="Filtered results summary"
          >
            <div>
              <span>CAMPAIGNS</span>
              <strong>{filteredResults.length.toLocaleString()}</strong>
            </div>
            <div>
              <span>WINS</span>
              <strong>{wins.toLocaleString()}</strong>
            </div>
            <div>
              <span>WIN RATE</span>
              <strong>{winRate.toFixed(1)}%</strong>
            </div>
            <button type="button" onClick={() => exportCsv(results)}>
              Download all results as CSV
            </button>
          </section>
          <section className={styles.aggregate}>
            <h2>Win rate by vocation and strategy</h2>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    {(
                      [
                        ["vocationId", "Vocation"],
                        ["strategyId", "Strategy"],
                        ["seeds", "Seeds"],
                        ["wins", "Wins"],
                        ["losses", "Losses"],
                        ["winRate", "Win rate"],
                        ["averageCleared", "Avg. cleared"],
                      ] as const
                    ).map(([key, label]) => (
                      <th key={key}>
                        <button
                          className={styles.sortButton}
                          type="button"
                          onClick={() => sortSummaryBy(key)}
                        >
                          {label}
                          {summarySort.key === key
                            ? summarySort.direction === "asc"
                              ? " ↑"
                              : " ↓"
                            : " ↕"}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row) => (
                    <tr key={`${row.vocationId}-${row.strategyId}`}>
                      <td>{displayValue(row.vocationId)}</td>
                      <td>{displayValue(row.strategyId)}</td>
                      <td>{row.seeds.toLocaleString()}</td>
                      <td>{row.wins.toLocaleString()}</td>
                      <td>{row.losses.toLocaleString()}</td>
                      <td>{row.winRate.toFixed(1)}%</td>
                      <td>{row.averageCleared.toFixed(2)} / 8</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className={styles.filters}>
            <label>
              Vocation
              <select
                value={vocationFilter}
                onChange={(event) => {
                  setVocationFilter(event.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All vocations</option>
                {vocations.map((vocation) => (
                  <option value={vocation.id} key={vocation.id}>
                    {vocation.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Strategy
              <select
                value={strategyFilter}
                onChange={(event) => {
                  setStrategyFilter(event.target.value);
                  setPage(0);
                }}
              >
                <option value="all">All strategies</option>
                {BALANCE_STRATEGIES.map((strategy) => (
                  <option value={strategy.id} key={strategy.id}>
                    {strategy.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Outcome
              <select
                value={outcomeFilter}
                onChange={(event) => {
                  setOutcomeFilter(event.target.value);
                  setPage(0);
                }}
              >
                <option value="all">Wins and losses</option>
                <option value="win">Wins</option>
                <option value="lose">Losses</option>
              </select>
            </label>
          </div>
          <div className={styles.tableMeta}>
            <span>
              {sortedResults.length.toLocaleString()} matching seed runs
            </span>
            <span>
              Rows {sortedResults.length ? page * pageSize + 1 : 0}–
              {Math.min((page + 1) * pageSize, sortedResults.length)} of{" "}
              {sortedResults.length.toLocaleString()}
            </span>
          </div>
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr>
                  <th>
                    <SortButton
                      column="seed"
                      label="Seed"
                      active={sort.key === "seed"}
                      direction={sort.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th>
                    <SortButton
                      column="vocationId"
                      label="Vocation"
                      active={sort.key === "vocationId"}
                      direction={sort.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th>
                    <SortButton
                      column="strategyId"
                      label="Strategy"
                      active={sort.key === "strategyId"}
                      direction={sort.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th>
                    <SortButton
                      column="outcome"
                      label="Result"
                      active={sort.key === "outcome"}
                      direction={sort.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th>
                    <SortButton
                      column="encountersCleared"
                      label="Cleared"
                      active={sort.key === "encountersCleared"}
                      direction={sort.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th>
                    <SortButton
                      column="encountersPlayed"
                      label="Played"
                      active={sort.key === "encountersPlayed"}
                      direction={sort.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th>
                    <SortButton
                      column="finalLives"
                      label="Lives"
                      active={sort.key === "finalLives"}
                      direction={sort.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th>
                    <SortButton
                      column="finalGold"
                      label="Gold"
                      active={sort.key === "finalGold"}
                      direction={sort.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th>
                    <SortButton
                      column="finalRosterSize"
                      label="Roster"
                      active={sort.key === "finalRosterSize"}
                      direction={sort.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th>
                    <SortButton
                      column="purchasesMade"
                      label="Purchases"
                      active={sort.key === "purchasesMade"}
                      direction={sort.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th>
                    <SortButton
                      column="rerollsUsed"
                      label="Rerolls"
                      active={sort.key === "rerollsUsed"}
                      direction={sort.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th className={styles.sortButton}>Inspect</th>
                  <th className={styles.sortButton}>Watch</th>
                  <th className={styles.sortButton}>Data</th>
                </tr>
              </thead>
              <tbody>
                {visibleResults.map((result, index) => {
                  const rowKey = `${result.vocationId}-${result.strategyId}-${result.seed}-${index}`;
                  return (
                  <Fragment key={rowKey}>
                  <tr>
                    <td>{result.seed}</td>
                    <td>{displayValue(result.vocationId)}</td>
                    <td>{displayValue(result.strategyId)}</td>
                    <td>
                      <span
                        className={`${styles.outcome} ${result.outcome === "win" ? styles.win : styles.loss}`}
                      >
                        {displayValue(result.outcome)}
                      </span>
                    </td>
                    <td>{result.encountersCleared} / 8</td>
                    <td>{result.encountersPlayed}</td>
                    <td>{result.finalLives}</td>
                    <td>{result.finalGold}</td>
                    <td>{result.finalRosterSize}</td>
                    <td>{result.purchasesMade}</td>
                    <td>{result.rerollsUsed}</td>
                    <td>
                      <button
                        className={styles.inspectButton}
                        type="button"
                        onClick={() => {
                          const strategy = BALANCE_STRATEGIES.find(
                            (candidate) => candidate.id === result.strategyId,
                          );
                          if (!strategy) return;
                          const entries: string[] = [];
                          runCampaign(result.seed, result.vocationId, strategy, { trace: entries });
                          setTraceKey(rowKey);
                          setTraceEntries(entries);
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                    <td>
                      <button
                        className={styles.inspectButton}
                        type="button"
                        onClick={() => {
                          const replay = createSimulationReplay(result);
                          if (replay) onPlayReplay(replay);
                        }}
                      >
                        Watch
                      </button>
                    </td>
                    <td>
                      <button
                        className={styles.inspectButton}
                        type="button"
                        onClick={() => {
                          const replay = createSimulationReplay(result);
                          if (replay) downloadReplay(replay);
                        }}
                      >
                        JSON
                      </button>
                    </td>
                  </tr>
                  {traceKey === rowKey && (
                    <tr>
                      <td className={styles.traceCell} colSpan={14}>
                        <details open>
                          <summary>Replay trace · {displayValue(result.vocationId)} · {displayValue(result.strategyId)} · seed {result.seed}</summary>
                          <ol>{traceEntries.map((entry, traceIndex) => <li key={`${traceIndex}-${entry}`}>{entry}</li>)}</ol>
                        </details>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <nav className={styles.pagination} aria-label="Results pages">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              ← Previous
            </button>
            <span>
              Page {page + 1} of {Math.max(1, pageCount)}
            </span>
            <button
              type="button"
              disabled={page + 1 >= pageCount}
              onClick={() =>
                setPage((current) => Math.min(pageCount - 1, current + 1))
              }
            >
              Next →
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
