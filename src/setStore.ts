import type { MementoLike } from "./types";

/** Persists a set of session ids (string[]) under a single Memento key. */
export class SetStore {
  constructor(private readonly memento: MementoLike, private readonly key: string) {}

  list(): string[] {
    return this.memento.get<string[]>(this.key, []);
  }
  has(id: string): boolean {
    return this.list().includes(id);
  }
  async add(id: string): Promise<void> {
    if (this.has(id)) return;
    await this.memento.update(this.key, [...this.list(), id]);
  }
  async addMany(ids: string[]): Promise<void> {
    const current = this.list();
    const added = ids.filter((id) => !current.includes(id));
    if (added.length > 0) await this.memento.update(this.key, [...current, ...added]);
  }
  async remove(id: string): Promise<void> {
    await this.memento.update(this.key, this.list().filter((x) => x !== id));
  }
  async toggle(id: string): Promise<void> {
    if (this.has(id)) await this.remove(id);
    else await this.add(id);
  }
}
