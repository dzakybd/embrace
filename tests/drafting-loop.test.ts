import { BaseAgent, InMemoryRunner, Workflow, createEvent, type InvocationContext } from '@google/adk'
import { describe, expect, it } from 'vitest'
import { DraftCheckAgent, draftLoop } from '@/lib/agents/pipeline'

/** Stands in for the Gemini drafter: a reply that promises an outcome, then a clean one once it gets feedback. */
class StubDrafter extends BaseAgent {
  calls: string[] = []
  protected async *runAsyncImpl(ctx: InvocationContext) {
    const feedback = String(ctx.session.state['draft_feedback'] ?? '')
    this.calls.push(feedback)
    const reply = feedback
      ? 'Thank you. Your report DMK-1 is with our team; we reply within 72 hours.'
      : 'Thank you. Your report DMK-1 will be resolved and you will definitely receive the aid.'
    yield createEvent({
      author: this.name,
      invocationId: ctx.invocationId,
      actions: { stateDelta: { draft: { reply, next_step: 'Stage 1' } } },
    })
  }
  protected async *runLiveImpl(ctx: InvocationContext) {
    yield* this.runAsyncImpl(ctx)
  }
}

describe('drafting loop', () => {
  it('sends a flagged draft back once with the findings, then stops when it passes', async () => {
    const drafter = new StubDrafter({ name: 'drafter_agent' })
    const check = new DraftCheckAgent({ name: 'draft_check_agent' })
    const loop = new Workflow({ name: 'drafting', dynamicEntry: (ctx) => draftLoop(ctx, drafter, check) })
    const checks: { warnings: string[]; rewrite: boolean }[] = []
    const run = new InMemoryRunner({ agent: loop, appName: 't' }).runEphemeral({
      userId: 'u',
      newMessage: { role: 'user', parts: [{ text: 'draft' }] },
      stateDelta: { complaint_text: 'my aid did not arrive', ticket_id: 'DMK-1', sop: [] },
    })
    for await (const ev of run) {
      const c = ev.actions?.stateDelta?.['draft_check'] as (typeof checks)[number] | undefined
      if (c) checks.push(c)
    }
    expect(drafter.calls).toHaveLength(2)
    expect(drafter.calls[1]).toMatch(/Promises an outcome/)
    expect(checks.map((c) => c.rewrite)).toEqual([true, false])
    expect(checks[1].warnings).toEqual([])
  })
})
