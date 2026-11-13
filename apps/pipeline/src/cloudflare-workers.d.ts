declare module 'cloudflare:workers' {
  export class DurableObject<Env = unknown> {
    ctx: DurableObjectState
    env: Env
    constructor(ctx: DurableObjectState, env: Env)
  }

  export interface DurableObjectState {
    storage: { get<T>(key: string): Promise<T | undefined> }
  }

  export class WorkflowEntrypoint<Env = unknown, Params = unknown> {
    env: Env
    constructor(ctx: ExecutionContext, env: Env)
  }

  export type WorkflowEvent<Params> = { payload: Params; instanceId: string }
  export type WorkflowStep = {
    do<T>(name: string, work: () => Promise<T>): Promise<T>
  }
}
