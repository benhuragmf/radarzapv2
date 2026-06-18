export interface ProactiveGreetingCheckInput {
  proactiveGreetingEnabled: boolean;
  proactiveGreetingMessage?: string | null;
  businessHoursEnabled: boolean;
  isOnline: boolean;
  proactiveGreetingSentAt?: Date | string | null;
  hasVisitorInbound: boolean;
}

export function shouldSendProactiveGreeting(input: ProactiveGreetingCheckInput): boolean {
  if (!input.proactiveGreetingEnabled) return false;
  if (!input.proactiveGreetingMessage?.trim()) return false;
  if (input.proactiveGreetingSentAt) return false;
  if (input.hasVisitorInbound) return false;
  if (input.businessHoursEnabled && !input.isOnline) return false;
  return true;
}
