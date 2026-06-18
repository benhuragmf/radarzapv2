export interface ProactiveGreetingCheckInput {
  proactiveGreetingEnabled: boolean;
  proactiveGreetingMessage?: string | null;
  proactiveGreetingSentAt?: Date | string | null;
  hasVisitorInbound: boolean;
  outboundCount?: number;
}

export function getProactiveGreetingSkipReason(
  input: ProactiveGreetingCheckInput,
): string | null {
  if (!input.proactiveGreetingEnabled) return 'disabled';
  if (!input.proactiveGreetingMessage?.trim()) return 'no_message';
  if (input.proactiveGreetingSentAt) return 'already_sent';
  if (input.hasVisitorInbound) return 'visitor_replied';
  if ((input.outboundCount ?? 0) > 0) return 'has_outbound';
  return null;
}

export function shouldSendProactiveGreeting(input: ProactiveGreetingCheckInput): boolean {
  return getProactiveGreetingSkipReason(input) === null;
}
