/** Serializa inbound por contato — evita corrida em rajadas (1, 2, 3). */
const chains = new Map<string, Promise<void>>();

export function enqueueInboundForContact(contactKey: string, task: () => Promise<void>): Promise<void> {
  const prev = chains.get(contactKey) ?? Promise.resolve();
  const next = prev
    .then(task)
    .catch(() => undefined)
    .finally(() => {
      if (chains.get(contactKey) === next) chains.delete(contactKey);
    });
  chains.set(contactKey, next);
  return next;
}
