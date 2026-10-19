// Command pattern + history — undo/redo for all scene mutations (SPEC §4).
import { bus } from '../bus'

export interface Command {
  execute(): void
  undo(): void
  description: string // shown in UI, e.g. "Apply Force Layout"
  // Called when the command is permanently discarded (redo branch cut off);
  // frees GPU resources that only this command still references.
  dispose?(): void
}

class CommandHistory {
  private undoStack: Command[] = []
  private redoStack: Command[] = []

  execute(command: Command): void {
    command.execute()
    this.undoStack.push(command)
    for (const discarded of this.redoStack) discarded.dispose?.()
    this.redoStack = []
    this.notify()
  }

  undo(): void {
    const cmd = this.undoStack.pop()
    if (cmd) {
      cmd.undo()
      this.redoStack.push(cmd)
      this.notify()
    }
  }

  redo(): void {
    const cmd = this.redoStack.pop()
    if (cmd) {
      cmd.execute()
      this.undoStack.push(cmd)
      this.notify()
    }
  }

  // Forget every step, e.g. when a network is deleted and old steps could
  // bring it back: each command frees what only it still holds.
  clear(): void {
    for (const cmd of [...this.undoStack, ...this.redoStack]) cmd.dispose?.()
    this.undoStack = []
    this.redoStack = []
    this.notify()
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  private notify(): void {
    bus.emit('history:changed', {
      canUndo: this.canUndo,
      canRedo: this.canRedo,
    })
  }
}

export const history = new CommandHistory()
