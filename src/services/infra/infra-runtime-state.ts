/** Estado de runtime pós-boot — AH-S01 degraded mode. */
export interface InfraRuntimeState {
  bootedAt: string | null;
  mongodbReady: boolean;
  redisReady: boolean;
  queuesReady: boolean;
  degraded: boolean;
  degradedReasons: string[];
}

const initialState = (): InfraRuntimeState => ({
  bootedAt: null,
  mongodbReady: false,
  redisReady: false,
  queuesReady: false,
  degraded: false,
  degradedReasons: [],
});

let runtime: InfraRuntimeState = initialState();

export function getInfraRuntimeState(): Readonly<InfraRuntimeState> {
  return runtime;
}

export function resetInfraRuntimeState(): void {
  runtime = initialState();
}

export function markInfraRuntime(patch: Partial<InfraRuntimeState>): void {
  runtime = {
    ...runtime,
    ...patch,
    degradedReasons: patch.degradedReasons ?? runtime.degradedReasons,
  };
}

export function finalizeInfraBoot(): void {
  runtime = {
    ...runtime,
    bootedAt: runtime.bootedAt ?? new Date().toISOString(),
  };
}

export function isDegradedBoot(): boolean {
  return runtime.degraded;
}
