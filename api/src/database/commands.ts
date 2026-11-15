import { type EntityManager, type EntityTarget, type FindOptionsWhere, LessThan, type ObjectLiteral } from 'typeorm';

/** How long a command id is remembered: long enough for any retry. */
const COMMAND_MEMORY_MS = 24 * 60 * 60 * 1000;

/** Drop command ids older than any retry could be (a command table's rows for one owner). */
export function forgetOldCommands<E extends ObjectLiteral & { createdAt: Date }>(manager: EntityManager, entity: EntityTarget<E>, owner: FindOptionsWhere<E>) {
  return manager.delete(entity, { ...owner, createdAt: LessThan(new Date(Date.now() - COMMAND_MEMORY_MS)) } as FindOptionsWhere<E>);
}

/**
 * A row locked until the transaction ends, created first when there is none. `create` must insert
 * with ON CONFLICT DO NOTHING, so two first visits at once both end up locking the same row.
 */
export async function lockOrCreate<E extends ObjectLiteral>(tx: EntityManager, entity: EntityTarget<E>, where: FindOptionsWhere<E>, create: () => Promise<unknown>): Promise<E> {
  const locked = () => tx.findOne(entity, { where, lock: { mode: 'pessimistic_write' } });
  const row = await locked();
  if (row) return row;
  await create();
  return (await locked())!;
}
