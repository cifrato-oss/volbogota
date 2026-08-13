/**
 * In-memory stand-in for Firestore, built for the booking transaction.
 *
 * The interesting behaviour of `crearReservaEnTransaccion` only exists under
 * concurrency: the seat counter must never oversell, and a request that loses a
 * race must be told the shift is full rather than quietly overwriting the
 * winner. A mock that just returns canned snapshots cannot exercise any of
 * that, so this one models what actually makes Firestore transactions safe —
 * optimistic concurrency over document versions.
 *
 * Every document carries a version. A transaction records the version of each
 * document it reads, and its writes only land if none of those versions moved
 * in the meantime. Reads and commits yield to the event loop, so transactions
 * started together genuinely interleave and the loser genuinely aborts.
 *
 * Only the surface the server code touches is implemented: equality `where`, a
 * single `orderBy`, `limit`, `startAfter`, and the transaction methods.
 */

type DocData = Record<string, unknown>;

type StoredDoc = { data: DocData; version: number };

/** Firestore signals lost contention with gRPC status 10. */
function abortedError(): Error & { code: number } {
  return Object.assign(new Error("ABORTED: too much contention"), { code: 10 });
}

export type FakeDocSnapshot = {
  id: string;
  exists: boolean;
  data: () => DocData | undefined;
};

function snapshot(id: string, stored: StoredDoc | undefined): FakeDocSnapshot {
  return {
    id,
    exists: stored !== undefined,
    // Cloned so a caller mutating the result cannot reach into the store.
    data: () => (stored ? { ...stored.data } : undefined),
  };
}

type Filter = { field: string; value: unknown };
type Order = { field: string; direction: "asc" | "desc" };

export class FakeFirestore {
  private readonly docs = new Map<string, StoredDoc>();

  /** How many times a transaction retries itself before surfacing ABORTED. */
  internalRetries = 5;

  /** When true every commit aborts, which is how a saturated shift behaves. */
  alwaysAbort = false;

  /** Collection paths whose documents report `exists: true` no matter what. */
  private readonly forcedExists = new Set<string>();

  /** Seeds a document. `path` is `collection/id`, subcollections included. */
  seed(path: string, data: DocData): void {
    this.docs.set(path, { data: { ...data }, version: 0 });
  }

  /** Reads a document straight out of the store, bypassing the query layer. */
  peek(path: string): DocData | undefined {
    const stored = this.docs.get(path);
    return stored ? { ...stored.data } : undefined;
  }

  /** Paths currently stored under a collection prefix, e.g. `reservas`. */
  pathsIn(collection: string): string[] {
    const prefix = `${collection}/`;
    return [...this.docs.keys()].filter(
      (path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"),
    );
  }

  /**
   * Makes every document in a collection read as existing.
   *
   * The only way to reach the code-collision branch: the reservation id is
   * random by design, so a test cannot seed the one that is about to be drawn.
   */
  forceExists(collection: string): void {
    this.forcedExists.add(collection);
  }

  private versionOf(path: string): number {
    return this.docs.get(path)?.version ?? -1;
  }

  private read(path: string, id: string): FakeDocSnapshot {
    const collection = path.split("/")[0] ?? "";
    if (this.forcedExists.has(collection) && !this.docs.has(path)) {
      return snapshot(id, { data: {}, version: 0 });
    }
    return snapshot(id, this.docs.get(path));
  }

  /** Hands control back to the event loop so concurrent work interleaves. */
  private async yield(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  collection(name: string): FakeQuery {
    return new FakeQuery(this, name);
  }

  batch(): FakeWriteBatch {
    return new FakeWriteBatch(this);
  }

  async runTransaction<TResult>(body: (tx: FakeTransaction) => Promise<TResult>): Promise<TResult> {
    for (let attempt = 0; attempt < this.internalRetries; attempt += 1) {
      const reads = new Map<string, number>();
      const writes: Array<() => void> = [];
      const tx = new FakeTransaction(this, reads, writes);

      // A rejection here is an answer — full shift, duplicate phone — and must
      // reach the caller instead of being retried as if it were contention.
      const result = await body(tx);

      await this.yield();

      const stale = [...reads].some(([path, version]) => this.versionOf(path) !== version);
      if (stale) continue;

      if (this.alwaysAbort) throw abortedError();

      for (const write of writes) write();
      return result;
    }

    throw abortedError();
  }

  /** @internal — used by the transaction and reference wrappers. */
  _readDoc(path: string, id: string, reads?: Map<string, number>): FakeDocSnapshot {
    reads?.set(path, this.versionOf(path));
    return this.read(path, id);
  }

  /** @internal */
  _set(path: string, data: DocData): void {
    const version = this.versionOf(path);
    this.docs.set(path, { data: { ...data }, version: version + 1 });
  }

  /** @internal — `set` with `{ merge: true }`, which creates when absent. */
  _merge(path: string, partial: DocData): void {
    const stored = this.docs.get(path);
    const data = stored ? { ...stored.data, ...partial } : { ...partial };
    this.docs.set(path, { data, version: (stored?.version ?? -1) + 1 });
  }

  /** @internal */
  _update(path: string, partial: DocData): void {
    const stored = this.docs.get(path);
    if (!stored) throw new Error(`No document to update at ${path}`);
    this.docs.set(path, { data: { ...stored.data, ...partial }, version: stored.version + 1 });
  }

  /** @internal */
  _delete(path: string): void {
    this.docs.delete(path);
    // A deleted path reports version -1, so a transaction that read the
    // document while it existed fails its version check instead of
    // resurrecting it.
  }

  /** @internal */
  _query(collection: string, filters: Filter[], order: Order | null, docs?: string[]): string[] {
    const prefix = `${collection}/`;
    const paths = (docs ?? [...this.docs.keys()]).filter(
      (path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"),
    );

    const matching = paths.filter((path) => {
      const data = this.docs.get(path)?.data ?? {};
      return filters.every((filter) => data[filter.field] === filter.value);
    });

    if (!order) return matching;

    const { field, direction } = order;
    return matching.sort((a, b) => {
      const left = String(this.docs.get(a)?.data[field] ?? "");
      const right = String(this.docs.get(b)?.data[field] ?? "");
      return direction === "asc" ? left.localeCompare(right) : right.localeCompare(left);
    });
  }

  /** @internal */
  _fieldOf(path: string, field: string): unknown {
    return this.docs.get(path)?.data[field];
  }

  /** @internal */
  async _yield(): Promise<void> {
    await this.yield();
  }
}

export class FakeDocRef {
  constructor(
    private readonly db: FakeFirestore,
    readonly path: string,
    readonly id: string,
  ) {}

  collection(name: string): FakeQuery {
    return new FakeQuery(this.db, `${this.path}/${name}`);
  }

  async get(): Promise<FakeDocSnapshot> {
    await this.db._yield();
    return this.db._readDoc(this.path, this.id);
  }

  async set(data: DocData, options?: { merge?: boolean }): Promise<void> {
    await this.db._yield();
    if (options?.merge) this.db._merge(this.path, data);
    else this.db._set(this.path, data);
  }

  async update(partial: DocData): Promise<void> {
    await this.db._yield();
    this.db._update(this.path, partial);
  }
}

/** Batched writes. Like Firestore's, they only land when `commit` runs. */
export class FakeWriteBatch {
  private readonly operaciones: Array<() => void> = [];

  constructor(private readonly db: FakeFirestore) {}

  set(ref: FakeDocRef, data: DocData, options?: { merge?: boolean }): FakeWriteBatch {
    this.operaciones.push(() => {
      if (options?.merge) this.db._merge(ref.path, data);
      else this.db._set(ref.path, data);
    });
    return this;
  }

  update(ref: FakeDocRef, partial: DocData): FakeWriteBatch {
    this.operaciones.push(() => this.db._update(ref.path, partial));
    return this;
  }

  delete(ref: FakeDocRef): FakeWriteBatch {
    this.operaciones.push(() => this.db._delete(ref.path));
    return this;
  }

  async commit(): Promise<void> {
    await this.db._yield();
    for (const operacion of this.operaciones) operacion();
  }
}

export class FakeQuery {
  private filters: Filter[] = [];
  private order: Order | null = null;
  private max: number | null = null;
  private cursor: string | null = null;

  constructor(
    private readonly db: FakeFirestore,
    private readonly collectionPath: string,
  ) {}

  doc(id: string): FakeDocRef {
    return new FakeDocRef(this.db, `${this.collectionPath}/${id}`, id);
  }

  where(field: string, _op: string, value: unknown): FakeQuery {
    const next = this.clone();
    next.filters = [...this.filters, { field, value }];
    return next;
  }

  orderBy(field: string, direction: "asc" | "desc" = "asc"): FakeQuery {
    const next = this.clone();
    next.order = { field, direction };
    return next;
  }

  limit(count: number): FakeQuery {
    const next = this.clone();
    next.max = count;
    return next;
  }

  startAfter(value: string): FakeQuery {
    const next = this.clone();
    next.cursor = value;
    return next;
  }

  async get(): Promise<{ docs: FakeDocSnapshot[]; size: number; empty: boolean }> {
    await this.db._yield();

    let paths = this.db._query(this.collectionPath, this.filters, this.order);

    if (this.cursor !== null && this.order) {
      const field = this.order.field;
      const cursor = this.cursor;
      const index = paths.findIndex((path) => String(this.db._fieldOf(path, field)) === cursor);
      paths = index === -1 ? paths : paths.slice(index + 1);
    }

    if (this.max !== null) paths = paths.slice(0, this.max);

    const docs = paths.map((path) => {
      const id = path.slice(path.lastIndexOf("/") + 1);
      return this.db._readDoc(path, id);
    });

    return { docs, size: docs.length, empty: docs.length === 0 };
  }

  private clone(): FakeQuery {
    const next = new FakeQuery(this.db, this.collectionPath);
    next.filters = [...this.filters];
    next.order = this.order;
    next.max = this.max;
    next.cursor = this.cursor;
    return next;
  }
}

export class FakeTransaction {
  constructor(
    private readonly db: FakeFirestore,
    private readonly reads: Map<string, number>,
    private readonly writes: Array<() => void>,
  ) {}

  async get(ref: FakeDocRef): Promise<FakeDocSnapshot> {
    await this.db._yield();
    return this.db._readDoc(ref.path, ref.id, this.reads);
  }

  set(ref: FakeDocRef, data: DocData): void {
    this.writes.push(() => this.db._set(ref.path, data));
  }

  update(ref: FakeDocRef, partial: DocData): void {
    this.writes.push(() => this.db._update(ref.path, partial));
  }

  delete(ref: FakeDocRef): void {
    this.writes.push(() => this.db._delete(ref.path));
  }
}
